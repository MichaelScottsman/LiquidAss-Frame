# Concept: the shared control vocabulary v2 (controls, keyboard, hover)

Phase 2 redesign of every control that the other concepts reuse: buttons, switches, check circles, sliders, pop-up buttons and their menus, segmented controls, text fields, lists and grouped rows, the VR keyboard, tooltips, and the hover, focus and press states of all of them. It is the vocabulary that `window-nav.md`, `settings.md`, `control-center.md`, `home-apps.md`, `social-media.md` and the game-page concept build their screens from. It uses `docs/phase2/DESIGN2.md` (cited **D2 §x**) and departs from it only where §2.2 says so and why.

**Revision 2.** This revision answers a critique (score 6.5). Every point and what changed is in §21. In short:
- the acceptance tests now match the spec, with exemptions that have their own criteria (§18);
- disabled controls show focus;
- the mute glyph can no longer sit under the slider knob;
- sliders that fill from an origin, notched sliders and default-value ticks are handled and proven on the device;
- the keyboard's key-block move is scoped away from the IME, emoji and buffered modes;
- the echo masks secret fields;
- no click depends on an unverified interactive crop;
- the keyboard platter has a build plan;
- the mockups include the hard real cases.

New device evidence is in §17: P-C7 to P-C12, all from 2026-10-07.

**Sources.**
- Audits: `audit/system.md` (**SY**), `shell-nav.md` (**SN**), `social-media.md` (**SM**), `library-apps.md` (**LA**), `game-pages.md` (**GP**).
- Capabilities: `capabilities/spatial.md` (**SP**), `steam-react.md` (**SR**), `native-e2e.md` (**E2E**), and `phase2/glassd-material.md` (**GM**).
- Research: `research/visionos.md` (**VR**), `liquid-glass-motion.md` (**MO**), `references.md` (**REF**).
- Inventories: `inventory/settings.md` (**INV-S**), `hud.md` (**INV-H**), `shell.md` (**INV-SH**), `bar.md` (**INV-B**), and `coverage/primitives.md` (**COV-P**).
- Sibling concepts: `settings.md`, `social-media.md`, `window-nav.md`, `control-center.md`.
- References: `refs/visionos/2, 3, 4, 8, 11`.

**Mockups.** They are drawn at true size with `mockups/kit.css` + `mockups/controls.css`. The real-page cases add `controls-real.css` and `controls-real.js`, and the sibling chrome from `settings-shared.js` and `window-nav-shared.js`. Render with `python tools/mockshot.py docs/phase2/mockups/controls-<name>.html shots/p2_controls_<name>.png`.

| Mockup | Render | Shows |
|---|---|---|
| **Real cases** | | |
| `controls-system.html` | `p2_controls_system.png` | Settings › System at true size. Gamepad focus is on a **switch inside a row**, the most common case: the row lights and the switch is lifted (§4.3) |
| `controls-system-popup.html` | `p2_controls_system-popup.png` | The same page with focus on the **rich Timezone pop-up** inside its row |
| `controls-system-disabled.html` | `p2_controls_system-disabled.png` | Focus on a **disabled** crash-report row: still visible (§4.7, P-C7) |
| `controls-timezone.html` | `p2_controls_timezone.png` | The **64-option Timezone menu**. The source is white; the menu is placed beside it because it fits neither below nor above; one scrolling column of two-line rows with fades and a position rail; check plus focus on the current value; flat on the window (§8.2, §14) |
| `controls-notifications.html` | `p2_controls_notifications.png` | The **Notifications check matrix**: four 80 px columns, sticky headers, labels up to three lines, focus on one check circle in a multi-control row, the disabled Feed column |
| `controls-quickaccess.html` | `p2_controls_quickaccess.png` | **Quick Access at m 0.83**, Steam's own popup with the T1 restyle: inert sun glyph under a low-value knob, the default-value marker, Volume and Microphone with a separate mute zone (normal and muted), and the Performance tab with Steam's real notch labels and a live overlap check |
| `controls-steamvr.html` | `p2_controls_steamvr.png` | **SteamVR settings at m 1.44**: option circles 60 at an 84 px pitch, the knob that carries its value, switches, and a SteamVR popover opening upward from its white source (laser only) |
| `controls-keyboard-t1.html` | `p2_controls_keyboard-t1.png` | **The CSS-only keyboard**: no glassd and keys unmoved. The echo sits in Steam's empty bottom band, masked for a password field (§12.3) |
| **Vocabulary boards** | | |
| `controls-states.html` | `p2_controls_states.png` | **The state matrix**: six controls × eight states, including disabled + focus and on + focus. The backdrop is even (4–6 L along each row, C20) |
| `controls-motion.html` | `p2_controls_motion.png` | The hover / press / gamepad / tooltip storyboard on the same even backdrop, with the 60 % first focus frame |
| `controls-buttons.html` | `p2_controls_buttons.png` | Circles 38–86, capsules 60/70, the roles, the six states with the laser lighting one button |
| `controls-switches.html`, `-t1` | `p2_controls_switches(-t1).png` | Switches (hit 88 × 80), check circles in 80 px cells, sliders (hover; drag as clear glass). `-t1` is the CSS-only version |
| `controls-pickers.html` | `p2_controls_pickers.png` | Segmented controls, a stepped slider, option circles 60/84, a pop-up and its value menu |
| `controls-fields.html` | `p2_controls_fields.png` | Search fields, labelled fields, a secure field, a growing multi-line field, an error field |
| `controls-lists.html` | `p2_controls_lists.png` | Grouped rows: navigation, information (80 px), destructive, single choice, rows with controls |
| `controls-tooltips.html` | `p2_controls_tooltips.png` | In-window and bar tooltips |
| `controls-keyboard.html`, `-pad`, `-dim` | `p2_controls_keyboard(-pad, -dim).png` | The visionOS keyboard: search typing, controller typing with accents, a dim room |

Reusable probe: `docs/phase2/concepts/controls-probe.js`, with parts `hit`, `slider`, `disabled`, `vgp`, `firstframe` and `kbsrc` (§17, §18). Every part passed on the device on 2026-10-07.

---

## 0. Summary

| Family | Is Steam's control right for VR? | Phase 2 form | Main tiers | Mockups |
|---|---|---|---|---|
| Buttons | **No.**<br>• 40 px tall (1.23°), 2 px corners.<br>• White fill on focus.<br>• "View FAQ" and "Factory Reset" are the same grey.<br>• "Back" is a text button.<br>• Footer-legend text is the laser's only path to X/Y/≡ actions (SY B.1, B.3.6; SN A.4). | • Circles for icons, capsules for text.<br>• 60 px regular (1.84°), 70 primary, 80 Play.<br>• One tinted action per screen; destructive actions have a red label.<br>• Glyph badges on buttons that have a gamepad shortcut. | T1, T2 | buttons, states |
| Switches | **No.**<br>• 38 × 22 (0.68°), Steam blue.<br>• A 4 px hover ring and a 2 px focus ring.<br>• The knob curve overshoots. | • visionOS switch, 66 × 40, green fill.<br>• **Hit 88 × 80**.<br>• The knob lifts into glass on press.<br>• **In a row, gamepad focus lights the row.** | T1 (P-C3), T2 | system, switches |
| Checkboxes | **No.** 22 × 22 at a 60 px pitch (0.68°); visionOS has no checkboxes. | • Check circles 40 px in 80 px cells.<br>• Focus is a light plate 12 px larger than the circle. | T1 | notifications |
| Sliders | **No.**<br>• 6 px track, 24 px knob.<br>• 10 px uppercase notch labels. | • Control Center capsules, 64 px.<br>• The value is a white fill **from Steam's origin**; 0 shows no white.<br>• The knob shows on hover, focus and drag.<br>• An **inert glyph** sits inside the fill; a **mute glyph** is a separate zone.<br>• Notches and the default tick are realigned to the 64 px knob (P-C8). | T1 (P-C2, P-C8), T2 | quickaccess, switches |
| Dropdowns | **Partly.** A menu is right. The 250 × 40 button, a sheet centred far from its source, 48 px rows and a floating title are not. | • 60 px pop-up capsule that turns white while open.<br>• The menu grows out of it below, above or beside it.<br>• 72 px rows; long lists scroll in two-line rows.<br>• **Flat until a wearer confirms crop clicks.** | T1, T2, T5 | timezone, pickers |
| Segmented | **No.** 32 px segments, a blue radial fill, 1 px dividers, a pulsing ring for focus. | 64 px recessed track with contiguous 60 px segments ≥ 140 wide; a white pill that travels. | T1, T2 | pickers |
| Text fields | **No.**<br>• 40 px square fields that turn solid white on focus.<br>• Italic placeholders.<br>• No focus at all in chat compose. | • 64 px recessed capsules with the one focus ring in the system.<br>• Labels above, notes below.<br>• A tinted well for errors. | T1, T2 | fields, keyboard-t1 |
| Lists | **No.**<br>• Flat 46–64 px rows with no grouping.<br>• 12 px descriptions.<br>• Focus is a solid grey slab. | • Grouped platters with **80 px rows**, information rows included.<br>• A pill inset 6 px, colour chips, trailing values. | T1, T2 | lists, system |
| Keyboard | **Partly.** Placement is good (SM B.3.3). It has no echo, no field context and a generic Enter; hover is solid white and press is blue. | • visionOS keyboard: raised keys over a frosted platter.<br>• An echo row (masked for secret fields).<br>• Context Enter labels, controller glyphs. | T1, T2, T3, T5 (planned) | keyboard, keyboard-t1 |
| Tooltips | **Partly.** On the bar only, with a 50 ms delay; icon-only circles have no names. | Glass capsules after 0.8 s; a new in-window layer. | T1, T2, T3 | tooltips, motion |
| Hover / focus / press | **No.**<br>• Hover is a grey fill or nothing.<br>• Focus is a solid white fill, a pulsing ring, or nothing.<br>• Disabled controls can take focus but show none.<br>• Press shrinks. | • One illumination model with no rings.<br>• Focus is 60 % visible on the first frame.<br>• Disabled + focus is visible.<br>• Press glows and swells. | T1, T2 | states, motion |

---

## 1. The experience

You raise the dashboard and **point at a button**. Nothing jumps. A soft light gathers under the laser, inside the button, and drifts with it as you move across; the button's fill brightens a little. You **pull the trigger**: the light spreads from where you pointed until the whole capsule glows, and the capsule swells by a few millimetres as if the glass took the press. It settles back as you release. The action happened the moment you clicked.

You **put the laser down and use the controller**. In Settings the controller lands on a switch or a pop-up inside a row. The **whole row lights up**: it brightens, with a light at its top and a thin highlight along its upper edge. The switch inside it lifts, and a soft glow appears around its knob. When you press the D-pad the next row lights at once, and the previous one fades out over half a second, so a held D-pad reads as one light moving down the list. On a row with several controls, such as the Notifications matrix with four circles per row, the row only warms and the circle you are on carries the light. A row that is **disabled** can still be reached, as in Steam today. It stays dim, but focus on it is still clearly visible: a faint pill and the same top highlight.

**Settings rows** sit on darker recessed platters, eighty pixels tall, the size of the rows in visionOS Settings. A switch is a green capsule the size of the one in visionOS; when you press it the knob swells into clear glass for a moment and slides across.

**Volume** is a thick capsule filled in white up to the current level. When you point at it a knob appears where the white ends; when you drag, the knob turns into a bead of clear glass that follows the laser exactly. At zero there is no white at all. Where Steam offers mute, the speaker sits in its own round zone at the start of the capsule. It is a button of its own, and it turns white while sound is muted. A setting with a handful of values, such as the refresh rate, is a stepped capsule with dots at each step and the values written underneath in normal type.

**A pop-up button** reads "5 Minutes" with a small up-and-down chevron. When you click it, it turns white, the way any visionOS button does while its menu is open, and the menu grows out of it: a dark glass slab with the setting's name at the top, the current value checked, and Cancel at the bottom. A list as long as the 64 timezones becomes a scrolling column of two-line rows that opens already on your current value.

You **click the search field**. A white ring of light appears around it, the only ring anywhere in the interface. Below the bar, the **keyboard** comes up: rounded keys on a slab of frosted glass. Along its edge a strip repeats what you are typing and names where it goes: "Search · hollow pe|". You no longer look up thirty degrees to check a word. In a password field the strip shows only dots. The Enter key is blue and reads "Search"; in a chat it reads "Send". When you hold a controller, small glyphs on the keys tell you that X deletes, Y types a space, the left trigger shifts and the right trigger sends.

**Point at an unlabelled circle** for a moment and its name materializes under it in a small glass capsule. The same happens after the controller's focus rests on it.

Nothing in any of this is new behaviour: every switch, slider, menu, field and key is Steam's own control and handler, at visionOS size, lit and shaped like visionOS.

---

## 2. Decisions

### 2.1 What this concept decides

| # | Decision | Why |
|---|---|---|
| C-D1 | **One illumination model for every control on every surface** (§4):<br>• hover = light at the pointer;<br>• focus = lit from within, plus the control's own highlight;<br>• press = a spreading glow, plus a swell for glass controls only. | D2 §10; SN C.10 asked for one language across quads; MO §4.2–4.4 |
| C-D2 | **Steam's floating FocusRing becomes an additive light plate**, with its animations off (§4.5) | It is the only focus cue for radios, checkboxes, recording-mode cards, links and scroll panels (INV-S §4.13). D2 R4 forbids rings, and its 20-times pulse runs at rest |
| C-D3 | **Gamepad press is visible**: a T2 capture listener on `vgp_onbuttondown` / `vgp_onbuttonup` sets `lgs-pressed` (§4.4) | **Proven on the device** (P-C1, P-C11): a passive capture listener sees Steam's dispatch, with `detail.button` |
| C-D4 | **Hit regions grow by geometry Steam already uses**: `scale` on switches and check circles, vertical padding on slider groups, a transparent `::before` extender where a pseudo-element is free. Switch extender: inset −12px −6px → **87.5 × 80.5** | Proven: P-C2, P-C3. A whole-row click target for switches is **not** stock and is not added |
| C-D5 | **Slider geometry for a 64 px knob.**<br>• `--slider-handle-width: 64px`.<br>• Our fill runs from `min(origin, value)` to `max(origin, value)`.<br>• **Notch cells 64 px wide**, and the **default tick moved 20 px in**. | P-C2: the knob centre equals the value. P-C8: Steam lays notches and the default tick out for a 24 px handle (up to 17.8 px off with a 64 px knob); with the two corrections, the error is 0 px |
| C-D6 | **Check circles**: off = shallow well with the "circle" symbol (a 2.5 px glyph ring, named in C5); on = blue whole fill + white check | A recessed well alone is invisible on a dark platter |
| C-D7 | **No microphone glyph in any field** | Steam has no dictation (SM C.2); a glyph with no function would mislead |
| C-D8 | **Keyboard colours**:<br>• hover and virtual focus = light (white .32 + a spot);<br>• pressed and Shift/Caps on = white .94 with a dark label. | D2 §8.2 reserves white for "on" |
| C-D9 | **Context Enter labels use Steam's `strEnterKeyLabel` path** | P-C4 |
| C-D10 | **In-window tooltips are new (T2)**. Bar tooltips are restyled and delayed to 0.8 s through `ShowTooltip` | D2 §9.1; Steam has tooltips only on the bar |
| C-D11 | **Spacing beats extenders for buttons**: 60 px buttons with ≥ 24 px clear gaps | D2 §17 #1 |
| C-D12 | **Keys never scale.** Buttons, circles and capsules swell ≤ ×1.06. Rows, cards, fields, switches and sliders only brighten; their knobs lift | MO §4.3, C4 |
| C-D13 | **Slider glyph rule.**<br>• An **inert** glyph (`G>FieldIcon`) sits inside the fill with `pointer-events: none`.<br>• A **mute** glyph (`%{ClickableSliderIcon}`) gets its own zone before the track. It is a toggle, white only while muted. | The knob can never sit on the mute target. 0 and muted read differently from "some volume" (critique 4) |
| C-D14 | **Focus inside a row**, the common case:<br>• **single-control row**: the row carries the focus, and the control is "lifted";<br>• **multi-control row**: the row warms (white .06), and the control carries the focus with a light bloom. | Focus on a switch or pop-up inside a row was the weakest cue (critique, verdict) |
| C-D15 | **Disabled + focus is visible**: content at 40 %, a white .10 fill, the highlight at 60 %, no spot, no swell. Disabled controls never use `opacity` on the whole element | Steam's D-pad focus lands on disabled controls (P-C7) |
| C-D16 | **No control's click depends on an unverified crop.**<br>• Menus and pop-up sources stay flat (a T5 slab at 2 mm for the material only).<br>• Primary capsules ≥ 70 px may pop ≤ 10 mm without being interactive.<br>• Interactive depth waits for the SP §12 wearer check (§14). | An interactive in-place crop click is [PLAUSIBLE] only (SP §2.4) |
| C-D17 | **The echo never shows more than the field.** Dots for password, one-time-code and PIN fields and for every field in a secret dialog; it is not gated on SteamVR's Keyboard Privacy, which is about controller poses (P-C10) | Critique 6, corrected by evidence |
| C-D18 | **The key-block move is scoped.** It is off whenever an IME row, the emoji/Steam-items layout or Steam's own buffered text row is present; the echo then uses the bottom band | P-C12 (source): those rows render inside the keyboard contents |
| C-D19 | **Long value lists (≥ 15 options) are the one menu that scrolls**: one column of two-line rows in a slab capped at the modal box | `window-nav.md` §5.1 keeps every shorter menu unscrolled; 64 timezones cannot fit |

### 2.2 Where this concept refines DESIGN2 or a sibling concept

| # | Source says | This concept does | Why |
|---|---|---|---|
| R1 | D2 §4: checkbox 40 × 40 rounded square | 40 px **circle** | visionOS uses circles for selection; matches `settings.md` §3.6 |
| R2 | D2 §4: a 20 px gap in a row, 24 px stacked; §17: a ≥ 21 px clear gap | A **24 px** clear gap between 60 px targets | 20 px fails the 21 px audit gate |
| R3 | D2 §7.5, kit, `window-nav` mockups: a mic inside the search field | No mic (C-D7) | No function behind it |
| R4 | `social-media.md` §3.3: the hovered key is white | The hovered key is lit (white .32); pressed and Shift-on keys are white | D2 §8.2 |
| R5 | D2 §7.11: the slider knob only on hover or focus | Also during drag, and **always on stepped sliders and SteamVR's sliders**, whose handle carries the value text | A stepped fill end otherwise sits 32 px past its label |
| R6 | D2 §10.1: rows never scale or lift; focus = + white .14 | Unchanged for the row itself. **Focus on a control inside a row** follows C-D14 | Revision 1 dimmed the row to .06 for every control inside it, the weakest cue in the system |
| R7 | D2 §7.9, §8.3: destructive = a red label at rest, a red fill on focus | The label is `rgb(255 130 125)` Semibold 24 px; error notes are white .86 with a red glyph | `--lgs-red` text measures 2.2–2.8:1 on grey glass; this colour measures 3.1–3.9:1 |
| R8 | Revision 1 §10: information rows 64 px | **80 px**, like every row in a platter | Matches `settings.md`; no exemption is needed |
| R9 | Revision 1 §13: SteamVR's Off/On pills as a segmented control | **Switches**, using `settings.md`'s T1 method (§4.10 there) | The sibling owns that page and its critic accepted switches |
| R10 | `settings.md` §4.10 and its mockup: refresh-rate circles of 104 SteamVR px at a 116 px pitch (72 main px, an 8 px gap) | **86 SteamVR px at a 121 px pitch** (60 main px, a 24 px gap) | An 8 px gap fails the 21 px rule. `settings.md` should adopt this |
| R11 | Revision 1 §10: no separators by default | A **2 px white .08 separator, inset 26 px**, between rows of a platter, hidden next to a lit row | Matches `settings.md`. With 80 px rows and no separators, rows ran together in the real pages |
| R12 | `control-center.md` §4.4: a glyph zone that is always white | The zone is a toggle, white only while muted (C-D13) | 0 and muted otherwise both read as "some volume". `control-center.md` should adopt it for its T3 sliders |
| R13 | D2 §3.8 and revision 1 §14: menus at +30 mm, pop-up sources at +15 mm as interactive crops | Flat until the SP §12 wearer check passes (C-D16) | A crop click is unverified, and no agent can test it |

---

## 3. Units, surfaces and the gallery

- **Units.** Sizes are main-window CSS px; **pt = px × 3/4** (D2 §2.1). On other surfaces, surface px = main px × m (D2 §2.5):

  | Surface | m |
  |---|---|
  | Window-plane popups and tooltips | 0.90 |
  | Bar and bar popups | 0.83 (1 popup px = 1.2 main px) |
  | Keyboard | 0.74 across, 0.84 vertically |
  | SteamVR frame controls | 1.33 |
  | SteamVR settings and Now Playing | 1.44 |
  | SteamVR binding UI | 1.87 |

- **Angles** at 0.0307°/px: 38 px = 1.17°, 60 = 1.84°, 64 = 1.96°, 70 = 2.15°, 80 = 2.46° (the 60 pt target), 86 = 2.64°.
- **The gallery** mockups are a spec board drawn as a visionOS window, not a product route. The live equivalent is Steam's own component zoo (`/zoo/buttons`, `/zoo/toggles`, `/zoo/sliders`, `/zoo/dropdowns`, `/zoo/fieldlayouts`, `/zoo/misc`, `/zoo/input`, `/zoo/modals`; INV-SH §17), where every T1 rule is verified first.
- **The real-case mockups** draw Steam's own pages and popups with their real labels, counts and states, inside the sibling concepts' chrome, so the vocabulary is seen where it is hardest: dense pages, popups at m 0.83, SteamVR at m 1.44, a 64-item menu, and the CSS-only fallback.

---

## 4. The illumination model (hover, focus, press)

The laser plays the role of the eyes. Steam's FocusNavController plays the role of controller focus: `.gpfocus`, `.gpfocuswithin`, and `%{Modal>Focused}` on keyboard keys. Every focusable shows a state in both models, and nothing is reachable by hover alone (D2 §10.4).

### 4.1 Layers of one control

| Layer | Where it lives | Rest | Hover (laser) | Focus (gamepad) | Press |
|---|---|---|---|---|---|
| Fill | the control's own background | **Raised:** white .10 + top sheen + `inset 0 1.5px 1.5px -1px` white .22 + `0 1px 2px` black .10.<br>**Recessed** (fields, tracks, wells): black .30 + `inset 0 2px 5px` black .30 + a lit lower lip | unchanged | **Unchanged.** Steam's focus fills (`ItemFocusAnim-*`, `forwards`) are overridden `!important` with the rest fill, so every focus contrast lives in the two layers below | unchanged |
| Illumination | a free pseudo-element, normally `::after`, `plus-lighter`, `pointer-events: none` | off | + white .08 uniform, + a radial white .12 at the laser hit point (`--hx/--hy`), to 0 at 75 % of the box | **Final:** + white .14 uniform + a radial white .16 at (50 %, 30 %).<br>**Entry:** `lgs-focus-in` (opacity .6 → 1, `hover-in` 294 ms b0), so the first frame shows exactly 60 % (P-C11) | + white .06, + a radial white .22 spreading from the hit point (laser) or the centre (A) to 120 % |
| Specular highlight ("lift into glass") | a second free pseudo-element, normally `::before` | off | off | A 1.5 px conic arc from the key light: peak white .75 at the top-left, gaps on both sides, never a closed loop. Same `lgs-focus-in` entry. Where `::before` is taken (rows, switches), an inset top highlight `inset 0 1.5px 1.5px -1px` white .55 on the pill or track | off |
| Swell | independent `scale` | — | — | — | glass controls only (buttons, circles, capsules, pop-ups, segments): `scale: min(1.06, 1 + 6 / maxSide)` |

States that are not interaction:

| State | Look |
|---|---|
| On / selected button, selected segment, open-menu source, pressed key, Shift or Caps on | white .94 fill, label `#0d0e12` (D2 §8.2) |
| Navigation selection (sidebar row, tab, list selection) | white .18 pill |
| Switch on / check on / primary / Play / destructive confirm | whole fill: green / blue / blue .86 / green .88 / red .84, white label or glyph |
| Focus on a white (on) control | White stays. A soft outer glow `0 0 18px 2px` white .30 is added, because additive light cannot brighten white. It is blurred, not a ring |
| Disabled | Content at 40 %, the fill at 40 % of its rest alpha, no hover response. **Focus stays visible** (§4.7) |

### 4.2 Hover light that follows the laser (T2)

- **Listener.** There is one `pointermove` listener per Steam window document (main, bar, bar popups, frame menus, keyboard), throttled to animation frames.
  - It finds `event.target.closest(<control selector list>)` and writes `--hx` / `--hy` as percentages on that element only.
  - On `pointerleave` it removes them.
  - Steam's laser drives real mouse events and `:hover` in these windows (INV-SH §9).
- **Fallback.** Without T2 (T1 only) the light is a static radial at (50 %, 30 %).
- **Cost.** One custom-property write per frame on one element while the pointer moves; nothing while it is still. Verified by C8 and C15.
- **If the laser dot is hidden.** Should the dot ever be hidden behind a crop (E2E #5, SP §2.4), the moving light still shows where the laser points, because Steam renders it inside its own texture.

### 4.3 Focus: lit from within, 60 % on the first frame, and focus inside rows

- **First frame.** The control's own fill never changes on focus (§4.1). Both focus layers enter with `@keyframes lgs-focus-in { from { opacity: .6 } to { opacity: 1 } }` on `hover-in`.
  - The first frame therefore holds 60 % of the final focus contrast by construction.
  - P-C11 proved this on the device. Focus moved within the same frame as `FocusNavController.DispatchVirtualButtonClick(10)`, and with the animations paused at time 0 the pseudo-element's computed opacity was exactly 0.60; 700 ms later it was 1.
- **Fading out.** The old focus leaves on `fade` (441 ms, b0) while the new one rises, so a held D-pad reads as one light moving (MO C5). No indicator travels between items (MO §4.4).
- **No depth.** Focus never scales a control or lifts it in depth (D2 rule 9). Content cards keep their lift; the library and game-page concepts own that.
- **Focus inside rows** (C-D14). Steam focuses the control inside a settings row and marks the row `.gpfocuswithin` (P-C7 walk: "English", "Check For Updates", the Timezone pop-up and so on are the focused elements). T2 tags each `G>Field` row by counting its `.Focusable` descendants: `data-lgs-ctl="1"` or `"n"`. The T1 fallback treats rows that contain `%{SettingTogglesCtn}` or `%{Toggles}` as multi-control and every other row as single-control.

  | Row | Row pill | Control |
  |---|---|---|
  | Single-control (switch, pop-up, button, slider) | **The row carries the focus:**<br>• white .14 + the spot;<br>• the inset top highlight;<br>• the same entry keyframe. | **Lifted:**<br>• switch: a glow `0 0 14px 3px` white .42 on the knob, + .10 light on the track;<br>• pop-up or button: + .10 fill light + its own arc;<br>• slider: the knob is shown. |
  | Multi-control (the Notifications matrix, toggle pairs) | **Warms**: white .06, no spot | **Carries the focus:**<br>• check circle: Steam's FocusRing as a light plate 12 px larger than the circle (§4.5), plus a glow on a blue (on) fill;<br>• switch: as above. |
  | The row itself focusable (navigation rows, info rows) | carries the focus | — |

### 4.4 Press, for both inputs

- **Laser:** `:active` (works in CEF, MO §4.3).
- **Gamepad A:**
  - Steam dispatches `vgp_onbuttondown` and `vgp_onbuttonup` as **bubbling, cancelable `CustomEvent`s** with `detail = {button, source, is_repeat}` on the focused element.
  - A capture listener on each window (`addEventListener('vgp_onbuttondown', fn, true)`) sees them first. P-C11 proved this on the device: one D-pad Down produced `vgp_onbuttondown` (button 10, source 1), `vgp_onblur`, `vgp_onfocus` and `vgp_onbuttonup`, in that order.
  - The listener adds `lgs-pressed` to the target's closest control when `detail.button === 1` (OK). It removes it on `vgp_onbuttonup`, or after 400 ms as a safety net.
  - It never cancels or re-dispatches the event.
- **Timing:**
  - press-in on `interactive` (210 ms, b15);
  - release: the glow goes off in 90 ms linear, and the swell returns on `snappy` (488 ms, b15);
  - the action fires on Steam's own schedule (MO C6).
- **No swell** on rows, cards, fields, keys, switches or sliders (C-D12).

### 4.5 Steam's floating FocusRing becomes a light plate

`%{FocusRing}` is the only focus cue for `.RadioButton` segments, `.DialogCheckbox`, `%{RecordingModeOption}`, links and scroll panels. Its geometry is inline (z 10000), with `outline: 2px solid rgba(255,255,255,.6)`, a 0.5 s flash, a 0.4 s outline grow and a 20-times opacity pulse (INV-S §4.13).

```css
html.lgs-on %{FocusRing}, html.lgs-on %{FocusRing}::before, html.lgs-on %{FocusRing}::after {
  animation: none !important;                                   /* no flash, grow or 20x pulse: nothing runs at rest (C13) */
}
html.lgs-on %{FocusRing} {
  outline-color: transparent !important;                        /* no ring */
  border-radius: min(var(--lgs-r-row), 50%) !important;         /* capsule on segments, circle on check circles */
  background: radial-gradient(circle at 50% 30%, rgb(255 255 255 / .16), transparent 75%), rgb(255 255 255 / .12) !important;
  mix-blend-mode: plus-lighter;
  box-shadow: 0 0 18px 2px rgb(255 255 255 / .22);              /* blurred glow, readable on white segments; not a ring */
  opacity: 1 !important;
}
/* on check circles the light is a bloom 12 px larger than the circle, drawn outside the ring's inline box */
html.lgs-on .lgs-ring-check { background: transparent !important; box-shadow: none; }
html.lgs-on .lgs-ring-check::before { content: ""; position: absolute; inset: -12px; border-radius: 50%; pointer-events: none;
  background: radial-gradient(circle, rgb(255 255 255 / .34) 0, rgb(255 255 255 / .22) 42%, transparent 72%); mix-blend-mode: plus-lighter; }
```

- **Why a tag.** `.lgs-ring-check` is a T2 tag on `%{FocusRingRoot}`. The `vgp_onfocus` listener (§4.4) sets it when the newly focused element is a `.DialogCheckbox` and removes it on the next focus.
- **Inline geometry is untouched.** The ring's top, left, width and height stay inline. The larger bloom is drawn by the ring's `::before` at `inset: -12px`. C5's computed-style read of `%{FocusRing}` checks that this pseudo-element is free; if it is not, the bloom is a T2 decorative child of the ring.
- **Fallback.** Without T2, check circles get the plain plate above, the size of the circle.

### 4.6 Reduce Motion and High Contrast

- **Reduce Motion** (`prefers-reduced-motion`): no swell, no knob lift, no pill lift or travel (the old pill fades out and the new one fades in), no blur ramps. Light and fades stay at ≤ 200 ms (MO C8). The entry keyframe becomes a 150 ms fade from .6.
- **High Contrast** (`prefers-contrast: more`):
  - controls get opaque fills (raised white .22, recessed black .55);
  - the 2 px solid white .70 edge is allowed on controls and glass (D2 §13);
  - the light spot is off;
  - focus = a white .30 fill + the 2 px edge;
  - disabled + focus = a white .18 fill + the 2 px edge at .40.

### 4.7 Disabled controls (new)

Steam keeps disabled controls focusable: the D-pad landed on "Can't click me" (`DialogButton Secondary Disabled … Focusable gpfocus`) on `/zoo/buttons` (P-C7). INV-S records the same for disabled toggles (`G>Toggle.G>Disabled` keeps `Focusable`) and for the dialog's disabled Continue.

| Control | Disabled | Disabled + focus (`.Disabled.gpfocus`, `[aria-disabled="true"].gpfocus`, `G>Disabled.gpfocus`, `.gpfocuswithin` on a disabled row) |
|---|---|---|
| Button, circle, pop-up | label white .40, fill white .04; Steam's `opacity: .4` overridden to 1, so the focus layers are not dimmed | fill white .10, label white .40, the arc at 60 %, no spot, no swell, no press glow |
| Switch | track white .07, knob white .42, no shadow | track + white .10, the track highlight at 60 % |
| Check circle | the glyph ring .14, the fill at 40 %, Steam's `saturate(.35)` kept | fill white .10, the ring .14, the arc at 60 % |
| Row | content at 40 % | pill white .10, the top highlight at 60 % |
| Slider | track black .20, the fill white .30 | the track highlight at 60 %, the knob shown at white .45 |

Shown in `p2_controls_system-disabled.png` and the last two columns of `p2_controls_states.png`.

---

## 5. Buttons

| Size | Visible | pt | Symbol | Label | Use | Hit |
|---|---|---|---|---|---|---|
| Mini circle | 38 | 28.5 | 18 | — | clear-field, disclosure; **alone only** | `::before` extender to 80 × 80 (inset −21px) |
| Small circle | 44 | 33 | 20 | — | inside an ornament next to text; alone only | 80 extender (inset −18px) |
| Regular circle | 60 | 45 | 26 | — | every icon-only action | spacing (C-D11) |
| Large circle | 70 | 52.5 | 30 | — | primary icon action | spacing |
| Hero circle | 86 | 64.5 | 36 | — | editorial / windowless views | spacing |
| Capsule | 60 tall, padding 24, min width 120 | 45 | 24 leading, gap 10 | Headline 24 px Semibold | every text or icon + text action | spacing |
| Large capsule | 70, padding 28 | 52.5 | 26 | 26 px Semibold | the screen's tinted primary | spacing |
| Play capsule | 80, padding 40 | 60 | 28 | 28 px Semibold | Play / Resume on the game page | itself |
| Hero capsule | 86, padding 34 | 64.5 | 28 | 28 px Semibold | editorial pages only | itself |

- **Shape.** Icon only = circle; text or icon + text = capsule (D2 rule 4). No square buttons and no text "Back" or "Close": Back is a 60 px circle with a chevron. A converted text button keeps its name as `aria-label` (T2 sets it from the original text where Steam has none) and gets a tooltip (§11). The audit allowlist in C3 checks this.
- **Spacing.** 24 px clear between neighbouring 60 px targets, in rows and in stacks. Every centre is then ≥ 84 px from the next.
- **Roles:**
  - secondary: the raised thin fill;
  - primary: blue .86 whole fill, white label; one per screen;
  - Play: green .88;
  - destructive action: `rgb(255 130 125)` Semibold label at rest, red .84 whole fill on focus or hover;
  - destructive confirm inside an alert: red whole fill at rest;
  - borderless inside ornaments, menus and toolbars;
  - floating: its own small glass (T5 `liquid` slab; T1 in-page `backdrop-filter` blur 14 + edges).
- **Controller glyph badge:** a 30 px circle (white .20) with a 16 px Bold letter at the trailing end of the capsule, on every visible button that has a gamepad shortcut.
- **Steam nodes:** `button.DialogButton` (+ `G>Button`, `.Primary`, `.Destructive`, `.GreenPlay`), `%{ShowKeyboardButton}`, `%{BuiltInLayoutButton}`, `%{BackButtonContent>BackButton}`, `%{ActionButtonLegend}`, and the header Back.
  - `::before` and `::after` are free on gamepad DialogButtons (INV-S §4.7).
  - Steam's focus white and the Primary/Destructive focus colours are overridden with `!important`.
  - The press swell uses the independent `scale` property, so Steam's own `transform` is never touched.
- **Disabled:** §4.7. `.Disabled` is `pointer-events: none` in Steam, so a disabled button takes no click; it still takes D-pad focus.

---

## 6. Switches and check circles

### 6.1 Switch

| Property | Value |
|---|---|
| Steam node | `%{*GamepadDialogContent>Toggle}`: a 38 × 22 rail with a 22 px knob. `G>ToggleRail::before` is Steam's on-fill, `G>ToggleSwitch` the knob, and `.gpfocus::after` Steam's focus halo (INV-S §4.3) |
| Size | `scale: 1.75` → **66.5 × 38.5 px** (49.9 × 28.9 pt; visionOS 51 × 31 pt). RTL: `scale: -1.75 1.75` |
| Hit | `G>Toggle::before` (free), inset **−12px −6px** before scaling → **87.5 × 80.5 px**. Proven: P-C3, re-run with −12 px. In 80 px rows two switch extenders overlap by 0.5 px, 40 px from either switch's centre: harmless |
| Track | **off:** white .16 + `inset 0 1px 3px` black .22.<br>**on:** Steam's `ToggleRail::before` recoloured to visionOS green (its transform untouched), top sheen |
| Knob | white, `0 2px 5px` black .30, drawn 3 px inside the track (`ToggleSwitch::after` inset 1.7 px before scale; whether this pseudo-element is free is read with `glass.py styles` on `/zoo/toggles` as part of C5). Fallback: Steam's full-height knob, recoloured |
| Hover | illumination on the track. **Steam's own hover ring (`G>Toggle:hover` → `box-shadow: 0 0 0 4px rgba(255,255,255,.3)`) is removed** with `box-shadow: none !important` (C5) |
| Focus | Steam's halo `Toggle.gpfocus::after` restyled into the illumination plate (white .14 + spot, radius 20 px after scale). Inside a row: lifted (§4.3). The track highlight goes on `G>ToggleRail::after` where it is free (the same C5 style read), otherwise it is omitted |
| Press | **The knob lifts into clear glass:** ×1.3 wide, ×1.2 high, white 1 → .35 with an arc, on `interactive`.<br>**Travel** on `snappy`. Steam's `cubic-bezier(.1,.12,.53,1.72)` is replaced, because it overshoots beyond the bounce ≤ .15 limit.<br>**Track colour** cross-fades at t50 (MO §4.15).<br>**Gamepad:** T2 adds `lgs-anim` for 500 ms when `aria-checked` changes |
| Disabled | §4.7 |

A click on the row label does **not** toggle (C-D4): Steam's `ToggleField` row forwards only a caller-provided `onClick` (P-C3). This matches visionOS, where only the switch toggles. Gamepad A on the focused switch toggles as today.

### 6.2 Check circle

| Property | Value |
|---|---|
| Steam node | `.DialogCheckbox`: 22 × 22, `.Active` when checked, svg `SVGIcon_DialogCheck`, focus via FocusRing |
| Size | `scale: 1.82` → **40 px** circle |
| Cells | `%{CheckboxColumn}` 50 → **80 px**; the sticky `%{CheckboxHeaders}` columns widen by the same rule (CS3) |
| Off | a shallow well, black .22, + the "circle" glyph `inset 0 0 0 2.5px` white .34 + `inset 0 2px 4px` black .30. **This ring is a symbol, not an outline:** it is the one spread shadow C5 allows on a control |
| On | blue whole fill + top sheen; Steam's check svg recoloured white, stroke 3 (its `stroke-dashoffset` transition kept) |
| Hover | illumination |
| Focus | the FocusRing light plate, **12 px larger than the circle (64 px)** with a radial bloom white .34 → 0 (§4.5); a blue fill also gets `0 0 16px 3px` white .38 |
| Hit | `.DialogCheckbox::before` (free), inset −11px before scaling → **80 × 80** |
| Disabled | §4.7 |
| Column headers | "Email", "Toast", "Mobile", "Feed": 18 px Semibold title case, centred over the 80 px cells; "Notify Me Via" 20 px text-2 |

---

## 7. Sliders

### 7.1 Facts the design rests on (proven on the device: P-C2, P-C8)

- **Drag and mapping.**
  - A drag starts on `mousedown` on **`SliderControlPanelGroup`**.
  - The value is `ComputeNormalizedValueForMousePosition(x) = (x − left − hw/2) / (W − hw)`, where `left` and `W` come from `SliderControlAndNotches` and `hw` is the handle element's width.
  - A 64 px track and a group padded to 88 px left the mid-point mapping unchanged, and points in the padding hit the group.
- **Knob centre.** With `--slider-handle-width: 64px` set on both `SliderControlAndNotches` and `.SliderControl` (Steam sets its own value on `.SliderControl`, which wins over inheritance), the handle is 64 × 64 and its centre equals the value (0.400 for 0.4).
- **Low values.** At v = 0, 0.05 and 0.1, `elementFromPoint` at the knob centre returns the slider group.
- **Fill.** Steam's own fill (`SliderTrack::before`) stays v × W, so it would end up to 32 px away from the knob. Hence our fill (C-D5).
- **Notches.** Each notch cell is `width/min-width: 24px; flex-basis: 0` in a `space-between` row. With a 64 px knob the outer ticks sat 17.8 px and the inner ticks 5.9 px off their values. With **`min-width: 64px; flex-basis: 64px`** the error is **0 px** at every tick, and the tick under the knob coincides with it.
- **Default tick.** `%{DefaultValueTick}` is 24 px wide at `inset-inline-end: 0` of a container translated by `−(1 − d) × (100% − handle width)`. With a 64 px knob it drifted 20 px (0.5 → 0.6075). With **`inset-inline-end: calc((var(--slider-handle-width) - 24px) / 2)`** it marks the same value as before (0.5, 0 px).
- **Origin.** The zoo's sliders all have `--normalized-slider-origin: 0`. Two carry `%{DefaultValueIsColorRange}` + `DefaultValueColorLeft/Right`, which paint Steam's fill as a two-colour range.

### 7.2 Continuous slider (Control Center style)

| Property | Value |
|---|---|
| Group | `SliderControlPanelGroup` padding-block so it is ≥ 80 px tall (hit) |
| Track | `SliderTrack` 64 px (48 pt; 1.96°), radius 32, recessed. Steam's `::before` fill is made transparent (colour only) |
| Value fill | our `SliderTrack::after`:<br>`left: calc(min(var(--o), var(--v)) * (100% - 64px))`<br>`width: calc(64px + (max(var(--o), var(--v)) - min(var(--o), var(--v))) * (100% - 64px))`<br>where `--v` = `--normalized-slider-value` and `--o` = `--normalized-slider-origin`. White .92 → .84 vertical gradient, radius 32. **At |v − o| = 0 the fill is invisible:** `opacity: clamp(0, |v − o| × 40, 1)`, written with `max(v − o, o − v)` because Chromium 126 has no `abs()` |
| Two-colour range sliders | `%{DefaultValueIsColorRange}`: our `::after` is off and Steam's `::before` is kept and recoloured (left part white .86, right part white .40). The handle stays Steam's 24 px, with a 48 px white disc drawn by `SliderHandle::after`. Only zoo examples are known; C23 lists any real setting that uses them |
| Glyph (C-D13) | **Inert** `G>FieldIcon` (Settings › Audio, both brightness sliders, and Quick Access today, P-C9): placed inside the fill's leading end at 19 px, 26 px, dark `#1b1c20` on white, **`pointer-events: none`**. At v = 0 it turns white .72 on the dark track (colour computed from v).<br>**Mute** `%{ClickableSliderIcon}` (INV-B §2 records it on Quick Access audio): see the next row |
| Mute zone | Steam's mute icon stays a separate target: a 64 px circular zone at the capsule's leading end. The capsule background spans both; the track begins after the zone, so the knob (x ≥ 64 + 0) can never cover it.<br>**Sound on:** the zone is clear with a white glyph.<br>**Muted:** the zone is white .94 with the dark slashed glyph (T2 reads Steam's muted state from the icon; if no state is readable, only Steam's own glyph change shows), and the level fill dims to white .24. Gamepad: as today. Hit: the zone 64 × 80 by the group padding |
| Knob | `SliderHandle` transparent; its `::after` (free) is a 58 px white disc, `0 2px 8px` black .32. Shown on `:hover` of the group, `.gpfocus` on the slider, `:active`, and in a focused single-control row |
| Default-value tick | Steam's `%{DefaultValueTick}` is kept, moved 20 px in (§7.1), recoloured as a 12 × 7 px white .72 marker above the capsule (`p2_controls_quickaccess.png`, Environment Brightness) |
| Drag | The knob grows ×1.25 as clear glass (radial white .30 → .04, `backdrop-filter: blur(2px) saturate(1.8) brightness(.86)`, an arc) on `interactive`.<br>The value follows the pointer with no easing (Steam's); release settles on `snappy`.<br>Steam's 200 ms focus "pop" keyframe (`scale(1.4)`) is removed: it is a bounce over the limit |
| Value text | trailing, 22 px Semibold tabular, text-2, in a 72 px column: Steam's `S>DescriptionValue` where the slider has one; otherwise a T2 decorative label from `--normalized-slider-value` × range |
| Value box | `S>EditableValue`: a recessed **60 px** capsule (raised from 48), min width 96, the focus ring of §9 |
| Gamepad | focus = knob shown + track light + highlight. Left/Right step the value (Steam's step), retargeting on auto-repeat. The footer keeps "B Done" |
| Popups (m 0.83) | the capsule is 54 popup px (65 main), the knob 48, the mute zone 54 |

### 7.3 Stepped slider (2–7 notches)

Applies to Refresh Rate, Performance Overlay Level, Scaling Mode, Scaling Filter and System Profile.

- **Shape.** Same capsule and group. The knob is **always shown**: a 50 px white disc with a stronger shadow at the current notch. The fill ends at the knob's centre (R5).
- **Notch cells** are `min-width: 64px; flex-basis: 64px` (§7.1, P-C8), so every tick sits at its value.
- **Ticks** (`S>SliderNotchTick`, 4 × 12) become 8 px dots inside the track: white .42 on the track, black .28 under the fill. The current one is hidden by the knob.
- **Labels** (`S>SliderNotchLabel`, 10 px bold uppercase, 0.5 px tracking) become **18 main px Semibold title case** with no tracking. That is **15 popup px** in Quick Access. The current label is white and the others text-2. Two-notch sliders with `AlignToEnds` keep their end alignment.
- **Crowding rule (T2).**
  - If two labels would come closer than 6 px, only the current label and the two end labels stay visible; the others keep their dots.
  - Steam's real Quick Access labels fit with no overlaps; the smallest gap is 10.7 popup px. They are "Off 1 2 3 4", "Auto Integer Fit Stretch Fill", "Linear Pixel Sharp", and "Performance / Playtime" at the ends (`p2_controls_quickaccess.png`, measured in the render; labels read live in P-C9).
  - The zoo's "One Two Three The fourth value" fit a 270 px slider on the device (P-C8).

### 7.4 Option circles (SteamVR's refresh-rate radio circles)

Circles of **60 main px at an 84 main-px pitch** (24 px clear) = **86 SteamVR px at 121**. 22 px Semibold tabular numerals; selected = white .94 with dark numerals; the others raised. They meet the target rule by spacing, with no exemption (R10). The SteamVR page itself is laid out by `settings.md` §4.10.

---

## 8. Pickers

### 8.1 Pop-up button

| Property | Value |
|---|---|
| Steam node | `%{DropDownControlButton}`: a `button` with `role=combobox` and `aria-expanded`; 250 × 40, rich 250 × 72 (INV-S §4.5) |
| Shape | capsule **60 px** (rich two-line: **76 px**, radius 30), min width 200, padding 0 20 0 24 |
| Content | the value, 22 px Medium white. Rich: the title 22 + one second line 18 text-2 that joins Steam's upper description and description ("UTC −04:00 · New York") by `order` on non-focusable text nodes. Steam's own caret glyph, 22 px, text-2 |
| States | raised; hover, focus and press per §4; **open = white .94 with dark text** (`[aria-expanded="true"]`); **flat** (C-D16) |
| Hit | spacing; 60 px in an 80 px row (rich: 76 in a 96 px row) |

### 8.2 Its value menu

The menu is Steam's gamepad context menu (`%{*BasicContextMenuModal>contextMenuContents}`). Its slab, rows, Cancel capsule and tones are specified in `window-nav.md` §5.1. What is specific to value pickers:

- **Layout by count** (window-nav §5.1.1, plus C-D19 for long lists):

  | Options | Layout |
  |---|---|
  | ≤ 5 | one column, 72 px rows |
  | 6–7 | compact rows |
  | 8–14 | a two-column grid |
  | **≥ 15** (Timezone 64, Language ≈ 29, keyboard layouts) | **one scrolling column of 100 px two-line rows** in a slab of **560 × 520**, capped at the modal box (y 108–628).<br>Steam's own scroller scrolls inside it, with 24 px fades at both ends (one edge effect, D2 §6.7) and a 5 px position rail.<br>Steam already scrolls the current value into view. |

- **Grows out of its source.** T2 records the trigger's rect at activation and sets `--sx --sy --sw --sh --sr` and the `translate` on the menu container.
  - The menu opens right-aligned **below** the source when it fits above y 628.
  - Otherwise **above** it.
  - Otherwise **beside** it, 16 px to the source's left, vertically centred on the source and clamped to the modal box. The Timezone menu is this case (`p2_controls_timezone.png`).
  - The morph runs on `morph-open` (607 ms, b .20) as a `clip-path` from the source rect (MO §6.4). Fallback: Steam's centred position, still morphing.
- **Header** inside the slab: the row's label ("Timezone"), 22 px Bold text-2 (T2 copies it).
- **Rows**: 72 px (long lists: 100 px two-line), 6 px apart, radius 24, 24 px Medium. The **current value** (`C>Selected`) has a trailing check (26 px, stroke 3), not a fill. Steam opens on it, so it shows check + focus.
- **Depth**: flat (C-D16). T1 draws the slab as in-page thick glass. With glassd, a `thick` slab at **dz 2 mm** (0.0054 units at r = 1) supplies the material; that is a parallax of 2.6 px at 45°. **+30 mm** returns once the wearer check passes (§14).
- **Close:** Steam removes the DOM. CSS close is instant; glassd plays `morph-close` (441 ms).

### 8.3 Segmented control

| Property | Value |
|---|---|
| Steam nodes | `%{Group}` (`Shared_Radio_Group`) with `%{Group>Button}` `.RadioButton` (`%{Group>Active}` selected; Steam's `::before` 1 px dividers); SteamVR `SegmentedControlGroup` (its `::after` sliding thumb). Tab strips use the same look in their own concepts |
| Track | 64 px (60 inside an 84 px ornament), padding **2**, recessed |
| Segments | **contiguous**: each segment is its full share of the track, 60 px tall and ≥ 140 px wide (≥ 120 compact), with no dead gap between segments. The visible fill is inset 2 px (`background-clip: content-box` + 2 px padding), so 4 px show between fills. 22 px Semibold labels; Steam's dividers transparent |
| Selected | white .94 pill, dark label, `0 2px 6px` black .22 |
| Hover / focus | illumination on the segment; radios focus through the FocusRing light plate; focus on the selected segment = white + soft glow |
| Pill travel (T2) | A decorative `div.lgs-pill` takes over the selected fill. On a change it moves on `snappy` (488 ms, b .15) and, for its first 180 ms, lifts into clear glass, then settles to white. Labels swap colour at t90 (MO §4.5). SteamVR's `::after` thumb gets the same timing and look |
| When not to use | more than 4 options, or labels over about 16 characters. T1 cannot change Steam's control type, so such groups keep the segmented form at ≥ 140 px per segment and wrap their row |

---

## 9. Text fields

| Property | Value |
|---|---|
| Steam nodes | `G>BasicTextInput` / `.DialogInput` / `DialogTextInputBase` in `DialogInput_Wrapper`; header search `%{SearchBox}`; chat `chatTextarea` (owner: social); slider value boxes `S>EditableValue`; labels `.DialogLabel` |
| Single line | **64 px** capsule (never below 60; 60 inside ornaments), radius 32; recessed; padding 0 12 0 24; leading glyph 26 px white .62 |
| Text | Body 24 px Medium white .96. The placeholder is white .55 and **upright**. The caret is blue (`caret-color`) |
| Focus | **3 px ring white .55 + 16 px glow**: the only ring in the system (D2 §8.2). Steam's solid white focused input is overridden `!important` |
| Hover | illumination on the **wrapper** `DialogInput_Wrapper::after` |
| Clear | 38 px circle, white .26, dark xmark 18 px. Hit **64 × 80**: a `::before` inset −21px vertically and −13px horizontally, so it eats at most 13 px of the text area. Nothing else is within 80 px of its centre |
| Label / note | label above: 20 px Semibold text-2, title case. Note below: 18 px Medium text-2; error notes white .86 with a red glyph |
| Error | a red-tinted well `rgb(255 66 69 / .22)`, a red exclamation glyph (T2) and the note. **No red outline** |
| Secure | dots, `letter-spacing: .12em`, a leading lock glyph; Steam's reveal control where it exists. The keyboard echo masks it (§12.3) |
| Multi-line | min 64 px, radius 30, padding 18 24, grows with Steam's autosize; a send action is a separate 60 px primary circle |
| Keyboard | opens on activation only (A or click), never on focus arrival (SM §0.3 item 4) |

---

## 10. Lists and grouped rows

| Element | Value |
|---|---|
| Platter | black .14, radius 30, 24 px from the glass edge, no outline |
| Row in a platter | **80 px contiguous** (hit 80); the visible pill is inset 6 px (68 px tall, radius 24); padding 0 26 |
| Separators | **2 px white .08, inset 26 px** (72 px after a chip), between rows of a platter; hidden on both sides of a lit row (R11) |
| Free-standing row (sidebars, menus) | 72 px + 8 px gap |
| Two-line row | 100 px (title Body 24 + subtitle 20 text-2). Rows whose label wraps (the Notifications matrix) grow with it: min 80, padding 10 |
| Leading | colour chip 40 px circle + white 22 px glyph (T2); avatar 48–56; art 56 radius 12 |
| Trailing | one of: a value (Callout 22 text-2) + a chevron 20 px text-3; a switch; a pop-up button; a 60 px capsule; four 80 px check cells; or, in single-choice lists, a 26 px blue check |
| Information row | **80 px** (R8), label + value text-2 (`G>LabelFieldValue`); focusable as in Steam |
| Section header | 22 px Semibold text-2, title case, 26 px inside the platter, 12 px above it |
| States | **hover:** pill white .08 + spot.<br>**focus** (the row itself, or a single control inside it): pill white .14 + spot + top highlight.<br>**focus on one of several controls:** pill white .06.<br>**navigation selected:** white .18.<br>**pressed:** + .06 glow, no scale.<br>**destructive:** a red Semibold label, a red .84 pill on hover or focus.<br>**disabled / disabled + focus:** §4.7 |
| Steam nodes | `G>Field` rows (the `HighlightOnFocus` keyframe fill overridden `!important`; `::before`/`::after` free on non-Classic rows). `%{RecordingModeOption}` radio cards become single-choice rows. Virtualised lists keep their row heights unless T3 changes `rowHeight` |

---

## 11. Tooltips

| Kind | Where | Look | Delay | Tier |
|---|---|---|---|---|
| **Bar tooltip** | Steam's `tooltip` popup (400 × 40 host, below the bar; INV-H §1) | the pill `%{PopupBody>Tooltip}` as a panel-glass capsule inside the clip rect: 40 popup px (= 48 main), 18 popup px Semibold, edges drawn inset | **0.8 s**: a wrapper on `vrPooledPopupStore.ShowTooltip` passes `unDelayMS: 800` (P-C5) | T1 + T3 wrapper; T5 `panel` cover |
| **In-window tooltip** (new) | every icon-only circle in the main window and its in-page ornaments, and every text button converted to a circle (§5) | one `div.lgs-tip` per window document (`pointer-events: none`, z 7100): a liquid-glass capsule 44 px, 20 px Semibold, 12 px under its owner (above it when the owner's bottom is below y 600), clamped 24 px inside | 0.8 s after `pointerover` or `vgp_onfocus`; out 0.2 s after leave or blur | T2 |
| **SteamVR frame-control tooltips** | `vr:systemui` capsules above the frame controls | as the bar tooltip at m 1.33 | SteamVR's | T1 `theme/vr` |

- Text: title case, one line, ≤ 32 characters, from the owner's `aria-label`.
- Motion: materialize in 250 ms; dematerialize in 350 ms where the node survives, instantly for Steam's popup.
- Depth: in-window tooltips owner + 5 mm as a CSS shadow only; bar tooltips keep Steam's popup z.
- A tooltip never covers the laser hit point and is never shown for controls that already show their text.
- Lab hygiene (E2E #4): every step that synthesizes hover sends `mouseleave` and checks `m_mapTooltips` is empty afterwards (C9).

---

## 12. The keyboard

### 12.1 Surface, modes and what may change

- **Quad.** Steam's `keyboard` quad is **854 × 280 keyboard px**. SteamVR places it 17–27° below the window centre, tilted back 50° (SM §0.3).
- **Never changed** (INV-H §5.5):
  - the quad's geometry;
  - the key hit areas (`%{KeyboardKeyHitArea}`, 60 × 47);
  - the label transforms;
  - `keyboard_appear`;
  - the `display: contents` grid cells;
  - key `pointer-events`;
  - `%{AriaLiveRegion}`.
- **Two modes (P-C12, source of module 52077).** The VR keyboard opens in **minimal** mode (`bMinimal`, or no buffer support), where each key goes straight to the focused field, or in **buffered** mode.
  - In buffered mode, Steam renders its own `%{VirtualKeyboardTextBuffer}` (the text, a cursor container and the rest of the text) as the first child of `%{VRVirtualKeyboardContents}`, above the keys.
  - The IME candidate row (`Row_IME`, or `KeyboardImeUnavailable`) renders as a `KeyboardRow` inside the key rows, and reports itself through `SetKeyboardIMEVisible`.
  - The emoji and Steam-items layout replaces the key panel (`%{Modal>EmojiKeyboard}`, with a category row).
  - A `ResizeObserver` on the keyboard div makes Steam call `ResizeTo` when a standalone keyboard's content outgrows its window. A CSS `translate` does not trigger it.
- **Key size.** Keys stay Steam's size: 2.5° wide (meets 60 pt) but 1.72° tall. Bigger keys would need a bigger quad, which SteamVR owns.

### 12.2 Layers, back to front

| Layer | Spec | Depth | Tier |
|---|---|---|---|
| Platter | glassd `thick` cover, 854 × 286, radius 30, following the keyboard overlay (plan in §12.8) | **0** for now; −10 mm after K-G6 | T5 (planned). **Fallback T1** (`p2_controls_keyboard-t1.png`): `%{Modal>Keyboard}.DefaultTheme { --background-color: rgb(28 30 38 / .84) }` + a top sheen + inset edge cues, radius 24 |
| Echo row | a recessed capsule 33 kb px tall, 8 px side insets, radius 17. It holds:<br>• a leading glyph;<br>• the **field's name**, 15 kb px Semibold text-2;<br>• the typed text, 19 kb px Medium (or **dots**, §12.3);<br>• a 2 px blue caret, selection blue .45, IME composition underlined;<br>• the placeholder at .55 when empty.<br>`pointer-events: none` | 0 | T2 |
| Echo position | **Top** (y 5–38), with the key block moved down 41 kb px (`translate: 0 41px` on `%{VRVirtualKeyboardContents}`; hit areas move with their keys), **only when** `%{Modal>Keyboard}:not(:has(.Row_IME, %{Modal>EmojiKeyboard}, %{VirtualKeyboardTextBuffer}))` (C-D18).<br>Otherwise **bottom** (y 242–275) with the keys unmoved.<br>In buffered mode our echo is not drawn: Steam's own text buffer gets the echo look | 0 | T1 + T2 |
| Keys | the visible key is Steam's `%{Modal>KeyboardKey}` with radius 11, inset ≈ 2 px in its hit area.<br>• Letters: white .15 + top sheen + top highlight + `0 2px 3px` black .22.<br>• Modifiers: white .075.<br>• Space: white .15.<br>• **Enter: blue .86** | 0 | T1 through Steam's skin variables on `.DefaultTheme` (INV-H §5.4); other skins untouched |
| Labels | letters 20 kb px Medium; shifted labels 15 kb px at .60; special keys 15 kb px Semibold title case; Steam's svgs 20 kb px | — | T1 |
| Controller glyphs | Steam's own `ActionButtonGlyph` on keys, as 22 kb px circles, white .22, 13.5 kb px Bold | — | T1 |

### 12.3 The echo row in detail (T2)

- **Source of truth.** In minimal mode, it is the main window's focused field. On `input`, `selectionchange` and `compositionupdate` the script reads `document.activeElement` (`value`, `selectionStart`, `selectionEnd`, `type`) and redraws the echo. It never writes to the field, never dispatches keys and never takes focus. It echoes only when `m_VRKeyboardState.m_sOpenForOverlayKey` is the main window's key; otherwise it shows the field name only.
- **Field name:**
  - the field's `aria-label` or placeholder;
  - otherwise a short map: header search → "Search", chat compose → "Message to <persona>", friend code → "Friend Code", dialog prompts → the dialog's title.
- **Masking (C-D17).** The echo shows **dots and never characters** when any of these holds:
  - the field is `type=password` or has a non-`none` `-webkit-text-security`;
  - `autocomplete` is `one-time-code`, `current-password` or `new-password`;
  - `inputmode` is `numeric` or `tel` inside a modal dialog;
  - the field sits in a dialog on the secret list, matched against Steam's own loc strings for those dialogs: Remote Play "Set PIN", Developer "Change User Password", Family View / Parental PIN, Steam Guard code entry, Wi-Fi and network passwords.

  The echo therefore never shows more than the field itself shows (the secret field also shows dots). It shows a lock glyph before the field name.
- **Keyboard Privacy (P-C10).** SteamVR's "Keyboard Privacy" (`/settings/steamvr/disableKeyboardPrivacy`, default false = privacy on) does not hide typed text. Its own warning text says that turning it off lets games stream controller poses while the VR keyboard is in use. It protects against apps inferring keystrokes from hand motion, which the echo does not affect. The echo is therefore not gated on it; secret fields are masked whatever the setting. If a later SteamVR version adds a display meaning, the T2 module reads the setting read-only through SteamVR's settings store and shows the field name only.
- **Long text:** the echo shows the end of the text around the caret, fading the left edge over 24 kb px.

### 12.4 States

| State | Steam class | Look |
|---|---|---|
| Hover (laser) and virtual focus (D-pad) | `%{Modal>Focused}` | white .32 + light spot + the key's arc; the label stays white. Enters at 60 % (§4.3) |
| Pressed | `%{Modal>Touched}` | **white .94 + dark label** + `0 0 16px 2px` white .30 glow on `interactive`; the glow goes off in 90 ms. Keys never scale |
| Shift one-shot / Caps lock | `%{Modal>ToggleOneShot}` / `%{Modal>ToggleOn}` | white .94, dark glyph; Caps adds a 3 kb px bar |
| Dead key | `%{Modal>KeyboardKeyDeadKey(Active)}` | active: white .94; inactive accent: text-3 |
| Accent bubble | `%{KeyboardExtendedRow}` (Steam's position, `top: -44px`) | a menu bubble on the platter: `rgb(44 46 54 / .96)` + top sheen, radius 17, padding 6; keys 48 kb px |
| Emoji / Steam Chat Items | `%{Modal>EmojiKeyboard}`, `%{KeyboardEmojiKey}`, category header | the same key tokens; category header 18 kb px title case; **key block not moved** |
| IME candidates | `Row_IME`, `%{KeyboardImeLutKey}` | 48 kb px chips, raised, the focused one lit; **key block not moved** |
| Buffered mode | `%{VirtualKeyboardTextBuffer}` | Steam's buffer gets the echo row's look (recessed capsule, 19 kb px text, blue cursor); **key block not moved** |

### 12.5 Context Enter label (T3, P-C4)

- **How Steam renders it.** Steam's keyboard renders the Enter key's text from `VirtualKeyboardManager.GetEnterKeyLabel()`, which returns the active element's `strEnterKeyLabel` (P-C12 shows the render path: a key whose `key` is "Enter" uses `GetEnterKeyLabel()` when it is set).
- **What this concept adds.** It supplies the label where Steam does not, through a wrapper on the manager's active-element-props setter (found by its source text, restored on theme off):
  - header search: "Search";
  - chat: "Send";
  - friend code: "Add";
  - URL: "Go";
  - dialog prompts and secret fields: "Done".

  Enter still sends Enter.
- **Fallback:** Steam's "Enter".

### 12.6 Controller bindings on the keyboard (P-C6)

| Input | Action |
|---|---|
| A | presses the focused key (hold for accents) |
| X | Delete (with repeat) |
| Y | Space |
| LT | Shift (one-shot) |
| RT | Enter |
| LB / RB | IME candidates and emoji categories |
| ≡ | moves the keyboard to its next position |
| View | quick-chat radial menu |
| Trackpads | type with trackpad pointers |
| B | closes the keyboard |

The glyph badges of §12.2 show X, Y, LT and RT on Delete, Space, Shift and Enter.

### 12.7 Motion and depth

- **Appear.** Steam's `keyboard_appear` (300 ms) is kept. glassd materializes the platter over 350 ms (`appear: "materialize"`, GM §5) once the daemon sends `phase` (K-G5). Hide: content first, then the glass.
- **Keys:** light in on the first-frame rule, out on `fade`; press on `interactive`.
- **Depth.** The keys are at the quad's plane. The platter is at the same plane until K-G6; the visible separation comes from the key shadows. With K-G6, −10 mm gives ≈ 0.7 display px of disparity at the keyboard's ≈ 1.0 m.
- **SteamVR's own keyboard** (`vr:keyboard`, used by OpenVR apps) gets the same tokens in `theme/vr`.

### 12.8 The T5 platter: what glassd must do first (new)

Revision 1 called the platter "glassd slabs [PROVEN-P1]". It is not. glassd draws covers only for the surfaces in `theme/layers.json`: main, bar, barpopup, frame.menu and floatingfooter. The keyboard is not one of them. The work, in order:

| # | Work | Where | Done when |
|---|---|---|---|
| K-G1 | **Report the keyboard as a surface.** A `keyboard` entry with the keyboard overlay's exact key (read it with `python glass.py surfaces` and `native/spike/ovprobe`; its window is `VRKeyboard_uid0`), `material: "thick"`, and `cover` = the keyboard container `%{Modal>Keyboard}` (radius 30). Steam's keyboard background becomes transparent where the cover shows (T1) | `theme/layers.json`, the reporter `device/lgs_layers.js` | `glassd-out.json` lists a `keyboard` surface while the keyboard is shown, and none after it hides |
| K-G2 | **Mask it from the room map.** glassd masks every reported surface's world quad from the feed (NATIVE.md, room model), so K-G1 brings the mask. The keyboard lies 17–27° below the window, outside the main window's mask zone (SP §11.2 item 2), so this must be checked | glassd room model | C24: a room-map dump with the keyboard up shows no key pixels in the map (look, then delete) |
| K-G3 | **The material without outlines.** `thick` v2 (GM §1–2: a crescent key highlight, a transmitted lower lip, Fresnel, no constant-width rim; it replaces the rim that native-e2e #2 rejected). The faint dashed lower lip seen once on a very wide, thin slab (GM §6.2) is unchecked; the platter is 286 kb px tall, which is not thin | glassd | C16: an hvgrab shows no line along the platter's edges |
| K-G4 | **Keys stay native.** The keys are Steam's own content shown in front of the cover at dz 0 (the base-mosaic pattern of the main window), so input lands on Steam's panel at the same x/y: no crop, no parallax | the scene-graph spec (`lgs_sg.js`) | C10: the hit areas are identical to stock; `L.pad` and laser hit tests pass |
| K-G5 | **Materialize** with `phase`/`appear` (GM §5). `lgs_shell.py` sends no `phase` today | `lgs_shell.py` | C17: `m` ramps 0 → 1 in 350 ms when the keyboard shows |
| K-G6 | **(Later) 10 mm stereo gap.** A cover offset behind its surface (negative `dz` for a cover, with the base mosaic kept at 0). glassd covers sit on the surface plane today | glassd + `lgs_sg.js` | C16: the platter is visibly behind the keys in an hvgrab |

- **Performance gate.** The live native mode already measures 1.9–2.5 ms (GM §4) against the 2.5 ms budget. A keyboard cover is about the cost of the bar cover (0.13 ms at 903 MHz, 0.28 ms at 422 MHz). C15b requires a median ≤ 2.5 ms with the keyboard up. If that fails, the main window's slabs are dropped while the keyboard is open (the window is about 30° above, mostly out of view); if it still fails, the keyboard stays T1.
- **Until K-G1 to K-G5 pass, the keyboard ships as T1.** The tier table (§16) marks the platter [PLANNED].

---

## 13. The vocabulary on other surfaces

| Surface | m | Switch | Slider | Row | Button | Text |
|---|---|---|---|---|---|---|
| Main window (Steam routes, menus, sheets) | 1.00 | 66 × 40 (hit 88 × 80) | 64 | 80 | 60 | 24 |
| Bar popups (Quick Access, Playspace, Streaming) | 0.83 | 55 × 32 popup px (`scale: 1.45`) | 54 popup px (= 65 main); notch labels 15 popup px (= 18 main) | 64 popup px (= 77 main) | 52–60 popup px | 19–20 popup px |
| Window-plane popups (frame menu, toasts, tooltips) | 0.90 | — | — | 72 popup px | 56 popup px circles | 22 popup px |
| Keyboard | 0.74 / 0.84 | — | — | — | keys: Steam's | 19–20 kb px |
| SteamVR frame controls | 1.33 | — | — | — | 80 systemui px circles where the atlas allows | 32 |
| SteamVR settings, Now Playing | 1.44 | 95 × 58 SteamVR px; SteamVR's Off/On pairs become **switches** (R9) | 92; SteamVR's knob carries its value and is always shown | 115 | 86; option circles **86 at a 121 pitch** (R10) | 35 |

`control-center.md`, `settings.md` §4.10 and `window-nav.md` §3.5 lay these surfaces out and take their control specs from this table. `p2_controls_quickaccess.png` and `p2_controls_steamvr.png` show the vocabulary at m 0.83 and 1.44.

---

## 14. Depth plan for controls (C-D16)

Interactive in-place crops are [PLAUSIBLE]: their registration is proven but their click is not (SP §2.4, §12), and no agent can test a click. So what ships first never puts a click behind a crop that has not been verified.

| Element | **Ships now** | Units at r = 1 | Parallax of the hit at 45° | After the SP §12 wearer check passes |
|---|---|---|---|---|
| Every in-window control (buttons, switches, sliders, fields, rows, segments) | 0 | 0 | 0 | 0 |
| Primary capsule ≥ 70 px tall (Play, Install, Apply) | **+10 mm, non-interactive pop** (`interactive: false`, the hit goes to Steam's panel) | 0.0271 | **13.0 px**: 18.6 % of a 70 px capsule, 16 % of an 80 px Play | +15 mm, interactive |
| Pop-up button while its menu is open | 0 (white fill and shadow) | 0 | 0 | +15 mm, interactive |
| Value menu | **0** in T1. With glassd, a `thick` slab under a non-interactive crop at **+2 mm**, for the material only | 0.0054 | 2.6 px (3.6 % of a 72 px row) | +30 mm, interactive, growing from +15 on `depth` |
| In-window tooltip | owner + 5 mm as a CSS shadow only | — | — | same |
| Keyboard keys / platter | 0 / 0 (K-G6 later: −10 mm) | 0 | 0 | same |
| Slider knob while dragged | 0 (`0 6px 16px` black .30) | — | — | same |

- **The parallax calculation.** A non-interactive crop at depth dz is seen dz × tan θ away from where the laser hits Steam's panel, at laser angle θ to the window normal (SP §2.4).
  - Units: 1 CSS px = 1.5 texture px × M (M = 1.5/1080 units per texture px, SP §1.1) = 0.0020833 units = 0.769 mm at r = 1. Both dz and the pixel scale with r, so the ratio is the same at any window size.

  | dz | θ = 30° | θ = 45° | θ = 60° |
  |---|---|---|---|
  | 10 mm | 7.5 px | 13.0 px | 22.5 px |
  | 2 mm | 1.5 px | 2.6 px | 4.5 px |

  - A 70 px capsule keeps the hit inside its own body (half-height 35 px) up to 60°. C21 holds every non-interactive pop to < 40 % of the popped element's smaller side at 45°.
- **The critique's 9 px figure.** It corresponds to about 7 mm. This concept keeps 10 mm, because stereo below about 10 mm is barely visible (0.35–0.43 display px per cm, D2 §2.6), and 13 px is still well inside the capsule.
- **Laser dot.** With a non-interactive pop, the dot is drawn on Steam's panel behind the crop. The crop shows Steam's own hover light at the pointer (§4.2), so the pointer position stays visible.
- **No ghosts.** Every popped region lies under the opaque glassd window cover (E2E rule 1).

---

## 15. Motion per control (MO tokens only)

| Interaction | In | Out | Notes |
|---|---|---|---|
| Hover light | `hover-in` 294 ms b0 | `fade` 441 ms b0 | the spot follows the pointer with no easing |
| Gamepad focus | `lgs-focus-in`: opacity .6 → 1 on `hover-in` 294 ms | `fade` 441 ms | 60 % on the first frame by construction (P-C11); no travelling indicator |
| Press (laser and A) | `interactive` 210 ms b15 | glow off 90 ms linear; swell back `snappy` 488 ms b15 | swell ≤ ×1.06, glass controls only |
| Switch | knob lift `interactive` 210; travel and settle `snappy` 488; track colour at t50 | — | MO §4.15 |
| Slider | knob lift `interactive` 210; value = pointer | settle `snappy` 488 | gamepad steps on `interactive`, retargeting |
| Segmented pill | travel `snappy` 488; lift 180 ms (t90) | — | labels swap at t90 |
| Pop-up menu | `morph-open` 607 ms b20, content 15–50 % | `morph-close` 441 ms (glassd only) | from the source rect |
| Tooltip | materialize 250 ms linear | dematerialize 350 ms | after 0.8 s / 0.2 s |
| Keyboard keys | 60 % at once, then `hover-in` | `fade` | press `interactive`; never scale |
| Keyboard platter | glassd materialize 350 ms (after K-G5) | dissolve after the keys | Steam's `keyboard_appear` kept |
| Field focus ring | `hover-in` 294 ms | `fade` 441 ms | ring opacity only, never its width |
| Reduce Motion | fades ≤ 200 ms, no swell, lift, travel or blur ramp | — | MO C8 |

**Nothing runs at rest.** One second after any interaction, no animation in any touched window has `playState === 'running'` (C13).
- Steam's `ItemFocusAnim-*` focus fills are `forwards` animations that end `finished`; they stay in `getAnimations()` while anything has focus, and that is allowed. P-C11 counted 2 `finished`, 0 `running`.
- The FocusRing's pulse, flash and grow are set to `animation: none` (§4.5).
- Steam's slider-handle "pop" keyframe is removed (§7.2).

---

## 16. Implementation tiers, evidence and fallbacks

| Element | Tier | Evidence that it is feasible | Fallback |
|---|---|---|---|
| Restyle of every primitive (fills, radii, type, states) | T1 | Phase 1 restyled all of them with 0 audit issues and stock fps (COV-P) [PROVEN-P1] | — |
| Switch 66 × 40 + 88 × 80 hit | T1 | **P-C3 [PROVEN]**, re-run with the −12 px extender: the centre, ends and extender (19 px out) hit the toggle; 25 px out does not | Steam's 38 × 22 with the extender and the new colours |
| Check circles 40 / 80 cells | T1 | the same mechanism as P-C3 [PLAUSIBLE]; sticky header alignment CS3 [UNPROVEN] | 40 px circles at Steam's 60 px pitch, extenders 60 wide × 80 tall |
| Capsule slider, 64 px knob, fill from origin | T1 | **P-C2 [PROVEN]** (mapping, knob = value, low values hit the group). The `min()/max()` fill is plain CSS on Steam's own variables [PLAUSIBLE until C2 runs in `theme` mode] | 24 px knob, 64 px capsule, Steam's `::before` fill recoloured |
| Notch cells 64 px, default tick moved 20 px | T1 | **P-C8 [PROVEN]**: tick error 0 px at all four notches; the default tick at the same value | Steam's 24 px knob on notched sliders (no misalignment, a smaller knob) |
| Inert glyph inside the fill | T1 layout of a non-focusable icon + `pointer-events: none` | D2 §12 [PLAUSIBLE]; P-C2's low-value hit test [PROVEN on /zoo] | the icon stays before the slider |
| Mute glyph as its own zone | T1 | Steam's DOM already puts the icon before the slider (INV-S §4.4) [PLAUSIBLE]. Whether the QAM icon is clickable today is unknown: P-C9 found no `%{ClickableSliderIcon}` on the Volume / Microphone rows | the icon stays where Steam draws it, recoloured |
| Pop-up capsule, open = white | T1 | `aria-expanded` exists (INV-S §4.5) [PLAUSIBLE] | white only on focus |
| Value menu anchored + morph; long lists scroll | T1 + T2 | `window-nav.md` §5.1.3; positioning the container changes no handler [PLAUSIBLE]; Steam's own scroller is kept | centred, still morphing |
| Menu material (+2 mm slab) | T5 | non-interactive pops and slabs ran live (E2E: header capsules and the nav column popped with slabs) [PROVEN, E2E live run]; GM v2 material [PROVEN on the test room and live] | T1 in-page thick glass |
| Primary capsule +10 mm non-interactive | T4 | as above [PROVEN, E2E live run]; the parallax bound is computed (§14) and tested by C21 | flat with a shadow |
| Interactive menu / source depth | T4 | crop registration [PROVEN, SP §2.2]; click [PLAUSIBLE, SP §2.4]: **not shipped** until SP §12 passes | flat (the shipped state) |
| Segmented 64 px, contiguous segments, pill travel | T1 + T2 | `%{Group}` sizes are padding; `lgs-pill` is decoration [PLAUSIBLE] | white selected segment without travel |
| FocusRing light plate, animations off | T1 | paint-only overrides of a node Phase 1 already restyles [PROVEN-P1] | Phase 1's soft ring |
| Focus first frame at 60 % | T1 | **P-C11 [PROVEN]**: pseudo opacity 0.60 at t0, 1.0 at 700 ms | — |
| Focus inside rows (single/multi) | T1 + T2 | `.gpfocuswithin` exists on rows (INV-S §4.2); counting focusables is DOM reading [PLAUSIBLE] | the T1 rule by `:has(%{SettingTogglesCtn}, %{Toggles})` |
| Disabled + focus | T1 | **P-C7 [PROVEN]**: focus lands on disabled buttons; the selectors are Steam's classes | — |
| Light spot at the pointer | T2 | the laser produces mouse events and `:hover` (INV-SH §9) [PLAUSIBLE] | static centred glow |
| Gamepad press glow | T2 | **P-C1 + P-C11 [PROVEN]**: a passive capture listener sees `vgp_onbuttondown` with `detail.button` | focus only on A |
| In-window tooltips | T2 | `vgp_onfocus` / `vgp_onblur` fire on the focused element (**P-C11 [PROVEN]**) | none (Steam has none today) |
| Bar tooltip delay 0.8 s | T3 wrapper | **P-C5 [source]**; the wrapper [PLAUSIBLE] | Steam's 50 ms + materialize |
| Field focus ring, hover on wrapper | T1 | INV-S §4.8 (the wrapper is a div) [PLAUSIBLE] | — |
| Keyboard keys, labels, states, glyphs | T1 via Steam's skin variables | INV-H §5.4; Phase 1 themes the keyboard [PROVEN-P1] | — |
| Keyboard echo + scoped key-block move | T2 + T1 | both windows are reachable from SharedJSContext; the IME, emoji and buffer rows are located (**P-C12 [source]**); the `:has()` scope is CSS | the echo in the bottom band (`p2_controls_keyboard-t1.png`) |
| Echo masking | T2 | DOM reads of `type`, `autocomplete`, `inputmode`, `-webkit-text-security` and the dialog title [PLAUSIBLE] | no echo for unknown fields |
| Context Enter label | T3 | **P-C4 / P-C12 [source]**: the render path reads `GetEnterKeyLabel()`; the injection point is [PLAUSIBLE] | "Enter" |
| Keyboard platter | T5 | **[PLANNED]**: K-G1 to K-G6 (§12.8). The pieces exist (layers.json surfaces, the GM v2 material, the per-surface feed mask); nothing has been run on the keyboard | T1 tinted keyboard background |
| Numeric keypad for the friend code | T3 | SM SQ13 [UNPROVEN] | full keyboard + echo "Friend Code" |

Everything is in memory:
- T1 rules and T2 listeners and nodes come and go with `lgs on/off`.
- The T3 wrappers keep the original function and restore it on removal.
- T4 nodes are retired on removal (SP §9 rule 1).
- glassd runs in the transient `lgs-shell` unit.

A Steam restart or a reboot returns the stock UI.

---

## 17. Device evidence (2026-10-07, Steam build 11094443)

Every probe was one of two things:
- a read-only source scan (`Function.prototype.toString` on webpack factories; SR §3.1);
- a `controls-probe.js` part inside one locked `glass.py js` step. Its only input was D-pad navigation through `FocusNavController`: Down/Up, and one Right from a page list into its page. Its geometry rules touched only Steam's `/zoo` demo controls. It removed every style, attribute and listener it added and restored the starting route.

Nothing was clicked, typed or pressed, and no setting was changed. Quick Access was opened and its tabs switched exactly as `audit/system-measure/qam_sweep.js` does: navigation only, the faked hover cleared, the popup closed by the locked step.

| # | Question | Result |
|---|---|---|
| **P-C1** | Can T2 see gamepad presses? | **Yes [PROVEN with P-C11].**<br>• Module 54654 creates `new CustomEvent(name, {bubbles: true, cancelable: true, detail})`.<br>• Steam dispatches `vgp_onbuttondown` / `vgp_onbuttonup` (`detail.button`, `source`, `is_repeat`) on the focused element (module 5757 `DispatchVirtualGamepad`; module 52077 for keys), and `vgp_onfocus` / `vgp_onblur` |
| **P-C2** | Does a taller slider keep its pointer mapping? | **Yes [PROVEN, `/zoo/sliders`].**<br>• Track 64 px, group 88 px: the mid value is unchanged; the ends map to −0.037 / 1.037 (± 32 px) with the 64 px handle.<br>• Handle 64 × 64, centre fraction 0.400 for the value 0.4.<br>• Knob centres at v = 0, 0.05 and 0.1 hit the group.<br>• **Finding:** `--slider-handle-width` must also be set on `.SliderControl`, which declares its own value |
| **P-C3** | Does `scale: 1.75` on a switch enlarge its target and keep its state? | **Yes [PROVEN, `/zoo/toggles`].**<br>• 66.5 × 38.5; the on knob at the right end, the off knob at the left.<br>• The −12px −6px extender hits 19 px above/below and 8 px left/right; 25 px out it does not.<br>• The click handler is on the Toggle (module 50777) |
| **P-C4** | Can the Enter key carry a context label? | Steam already supports `strEnterKeyLabel` → `virtualKeyboardProps` → `GetEnterKeyLabel()` → the Enter key [source] |
| **P-C5** | Can bar tooltips wait 0.8 s? | `ShowTooltip(el, text, params, fn)` honours `m_Params.unDelayMS` [source; the wrapper is PLAUSIBLE] |
| **P-C6** | Which controller buttons does the keyboard use? | A, X delete, Y space, LT shift, RT enter, LB/RB IME and emoji, ≡ move, View quick chat, trackpads (module 52077) [source] |
| **P-C7** | Can D-pad focus land on a disabled control? | **Yes [PROVEN].**<br>• On `/zoo/buttons`, focus walked onto "Can't click me", class `DialogButton Secondary Disabled … Focusable gpfocus`.<br>• On `/settings/system` the 14-step walk passed the language, update, beta and timezone controls, then unlabelled toggle elements. This readout does not show whether it reached the six disabled crash-report rows: the probe's test reads class names, and `G>Disabled` is hashed. C6 re-checks those rows with the `G>Disabled` token.<br>• The zoo case proves the rule.<br>• `controls-probe.js` part `disabled` |
| **P-C8** | Do notches and the default tick follow a 64 px knob? | **Not by themselves [PROVEN, `/zoo/sliders`].**<br>• Notch cells are `width/min-width: 24px; flex-basis: 0`: with a 64 px knob the ticks were off by −17.8 / −5.9 / +5.9 / +17.8 px.<br>• `min-width: 64px; flex-basis: 64px` gives 0 px at every tick, and the knob sits on its tick.<br>• The default tick drifted 20 px (0.5 → 0.6075); `inset-inline-end: calc((var(--slider-handle-width) - 24px)/2)` restores it exactly.<br>• No zoo slider has a non-zero origin; two use `DefaultValueIsColorRange` + `DefaultValueColorLeft/Right`.<br>• 18 px Semibold labels "One / Two / Three / The fourth value" fit a 270 px slider with no overlap |
| **P-C9** | What are Quick Access's real slider labels and icons? | Read live:<br>• System Profile (2: "PERFORMANCE", "PLAYTIME");<br>• Performance Overlay Level (5: "OFF 1 2 3 4");<br>• Scaling Mode (5: "AUTO INTEGER FIT STRETCH FILL");<br>• Scaling Filter (3: "LINEAR PIXEL SHARP");<br>• Refresh Rate (2: "72", "144"), all 270 popup px wide.<br>Brightness, Environment Brightness, Volume and Microphone (237–240 px) carry a 30 px `G>FieldIcon`, and **none matched `%{ClickableSliderIcon}`** on this build (INV-B §2 recorded clickable mute icons earlier). Hence C-D13 keys the mute zone on the presence of that class |
| **P-C10** | What does SteamVR's Keyboard Privacy do? | **Source scan of `vr:systemui`.**<br>• The toggle is `/settings/steamvr/disableKeyboardPrivacy` with `swapOnOff` (default false = privacy on).<br>• Its warning says that disabling it allows games to stream controller poses while the VR keyboard is in use.<br>• A flag `SystemKeyboardPrivacy = 1024` exists in a SteamVR state enum.<br>It is about pose streaming to apps, not about displaying text (§12.3) |
| **P-C11** | Do the gamepad path and the 60 % first frame work on the device? | **Yes [PROVEN, `/zoo/buttons`].**<br>• A passive capture listener on the main window saw `vgp_onbuttondown` (button 10, source 1), `vgp_onblur`, `vgp_onfocus` and `vgp_onbuttonup` for one D-pad Down.<br>• After `DispatchVirtualButtonClick(10)` focus moved in the same frame. With the `.6 → 1` entry keyframe paused at t0, the pseudo-element's opacity was 0.60; it was 1.00 at 700 ms.<br>• `document.getAnimations()` then held 2 `finished` and 0 `running` animations |
| **P-C12** | Where do the IME, emoji and buffered rows render? | **Source scan of modules 27752, 52077 and 67067.**<br>• `VRVirtualKeyboardContents` renders `[!bMinimal && <TextBuffer text cursorPos/>, <Keyboard …/>]`, so the buffered mode has Steam's own echo (`VirtualKeyboardTextBuffer`, `…Text`, `…CursorContainer`, `…Cursor`).<br>• `Row_IME` is a `KeyboardRow` inside the keyboard, reported by `SetKeyboardIMEVisible`.<br>• The emoji layout is `KeyboardPanel.EmojiKeyboard`.<br>• `SetKeyboardDiv` installs a `ResizeObserver` that `ResizeTo`s a standalone keyboard window when its content outgrows it |

---

## 18. Acceptance tests (agents only)

Live steps follow these rules:
- use the locked lab commands (LAB.md);
- use only Steam's `/zoo` demo pages for anything beyond looking and D-pad navigation;
- restore whatever they change;
- never press A/B/X/Y on a real control, never type into a real field, never change a setting;
- every step that synthesizes hover sends `mouseleave` afterwards.

### 18.1 Target-size criteria and exemptions (used by C4)

The default criterion (D2 §17): **a hit box ≥ 80 × 80, or a visible box ≥ 60 whose centre is ≥ 80 px from every other target with ≥ 21 px clear.** Multiply by m on other surfaces. These elements meet a criterion of their own:

| Element | Visible | Its criterion (measured with an `elementFromPoint` grid at 4 px) |
|---|---|---|
| Switch | 66.5 × 38.5 | hit ≥ 86 × 80 around the centre |
| Check circle | 40 | hit ≥ 80 × 80; column pitch 80 |
| Mini / small circle (alone) | 38 / 44 | hit ≥ 80 × 80, and no other target within 80 px of its centre |
| Clear circle in a field | 38 | hit ≥ 64 × 80, and no other target within 80 px of its centre (the field it clears excepted) |
| Segment of a segmented control | 56 visible in a 60 px contiguous hit | every x across the track hits a segment (no dead gap); each segment ≥ 60 × 140 (120 compact); no other target within 10 px above or below the track |
| Option circle (SteamVR) | 60 main (86 SteamVR) | the default criterion: pitch 84 (gap 24) |
| Rows in a platter | pill 68 in an 80 px row | hit 80 tall, contiguous |
| Compact menu rows (`window-nav.md` §5.1) | 60 on a 64 pitch | window-nav AT-11b |
| Slider value box | 60 | the default criterion |
| Keyboard keys | Steam's | Steam's geometry: the quad and every `%{KeyboardKeyHitArea}` rect identical to stock (C10) |
| Bar-popup controls | m 0.83 | every number above × 0.83 in popup px |

### 18.2 Tests

| # | Test | Command / method | Pass |
|---|---|---|---|
| C1 | Mockups render | `python tools/mockshot.py docs/phase2/mockups/controls-<name>.html shots/p2_controls_<name>.png` for the 20 files | 20 PNGs; `data-lgk-ready` set |
| C2 | Switch and slider geometry | `python glass.py js "$(cat docs/phase2/concepts/controls-probe.js)({parts:['hit','slider']})"` (`mode:'theme'` once the primitives ship) | `ok: true`: 10 checks (switch ×2, slider ×5, default tick, notch alignment, notch labels); route restored. Passed 2026-10-07 in `probe` mode |
| C3 | Functions kept | `python glass.py audit main --route /zoo/<page>` for buttons, toggles, sliders, dropdowns, fieldlayouts, misc, input; `--route /settings/<page>` for all 25 settings routes | GONE / UNCLICKABLE = 0; CONTRAST = 0; HIDDEN / SHRUNK = 0 **except the allowlist below** |
| C3a | Text → circle allowlist | for each allowlisted element (`#header %{BackContainer}`; `DialogButton`s labelled Back or Close that become circles): read its stock text with the theme off, then with it on | `aria-label` equals the stock text; `elementFromPoint` at its centre hits it; its tooltip shows that text (C9) |
| C4 | Sizes | a DOM sweep on the C3 routes and in Quick Access: every `.Focusable`'s visible box and hit box | each element meets its criterion in §18.1; text ≥ 18 px (main px); no `text-transform: uppercase`, italic or positive tracking on control labels |
| C5 | No outlines (and free pseudo-elements) | computed styles of every control class, of `%{FocusRing}` and its `::before`, of `G>ToggleSwitch::after` and `G>ToggleRail::after`, and of `G>Toggle:hover` (with a synthetic `mouseover`, then `mouseleave`) | `border-width: 0`; `outline-style: none` or a transparent outline; **no box-shadow layer of the form `0 0 0 Npx` (zero offset, zero blur, N > 0) anywhere**, except (a) `.DialogCheckbox:not(.Active)`, the "circle" glyph (inset 2.5 px), and (b) the focused text field's 3 px ring; under emulated `prefers-contrast: more` the 2 px edge is also allowed. Steam's `0 0 0 4px` toggle hover ring must be gone. With the theme off, the pseudo-elements the vocabulary uses have `content: none` (free) |
| C6 | Focus visible, 60 % at once, including disabled | on `/zoo/buttons` (with its disabled "Can't click me"), `/zoo/toggles`, `/zoo/dropdowns` and `/settings/system`: `inst.FocusApplicationRoot()`, then for each step `FocusNavController.DispatchVirtualButtonClick(10)`. **Immediately** pause every `lgs-focus-in` animation at `currentTime = 0`, read the computed opacity of the new focus's `::after` / `::before`, then `shot main`. Resume, wait 700 ms, `shot main` again. One extra rest shot with focus elsewhere | opacity at t0 = 0.60 ± 0.02; in the shots, L(t0) − L(rest) ≥ 0.6 × (L(final) − L(rest)) over the control's box; L(final) − L(rest) ≥ 6 % of full scale (**≥ 4 % for disabled + focus**); two shots 1.5 s apart identical. P-C11 passed the opacity half on `/zoo/buttons` |
| C7 | Gamepad press class path | a passive capture listener on the main window during one `L.pad('down')` on `/zoo/buttons` (`controls-probe.js` part `vgp`); then the T2 module's handler with that real event recorded | `vgp_onbuttondown` arrives with `detail.button === 10` (passed 2026-10-07); fed `{button: 1}` events, the handler sets `lgs-pressed` and clears it ≤ 100 ms after the matching up; ignores other buttons; never calls `preventDefault` |
| C8 | Light spot | dispatch `pointermove` over a zoo button; then idle 1 s with a `MutationObserver` on `style` | `--hx/--hy` follow within one frame; zero writes while idle |
| C9 | Tooltips | in-window: `pointerover` on the header Back circle, check at 500 and 900 ms, `pointerout`. Bar: the INV-H §1.2 recipe with the wrapper active; read `m_mapTooltips` at 500 and 900 ms; **always** send `mouseleave` | none at 500 ms; the owner's name at 900 ms; gone ≤ 250 ms after leaving; `m_mapTooltips` empty after cleanup (E2E #4) |
| C10 | Keyboard look and geometry | INV-H §5.2 recipes (`Keyboard.Show()` with auto-hide; a synthetic `mouseover` on `[data-key="g"]`, then `mouseleave`); `shot keyboard`; `audit keyboard`; `native/spike/ovprobe` before and after | 0 audit issues; quad corners and every key hit-area rect identical to stock (unmoved case); the hovered key lit, not white; keyboard closed afterwards |
| C11 | Echo and key-block move | `__LGS_CTL.echoTest('Liquid Glass')` (display only) with the keyboard shown; `shot keyboard`; `elementFromPoint` at each key centre | the echo shows the label, text and caret; with the move active, every key's hit area is under its visible key |
| C11b | Echo masking | on `/zoo/input`, inside one step, set `type=password` on a demo input and focus it (no typing), call `echoTest`; restore `type`. Repeat with `autocomplete="one-time-code"`, and with the input wrapped in a temporary `div[data-lgs-secret-dialog]` | dots and a lock glyph each time, never characters; the attributes restored |
| C11c | Move scoped away from IME, emoji and buffer | with the keyboard shown, append a temporary empty `div.Row_IME`, then one with the `%{Modal>EmojiKeyboard}` class, then one with `%{VirtualKeyboardTextBuffer}`, each inside `%{VRVirtualKeyboardContents}`; read the computed `translate`; remove each | `translate` = `none` while any of them is present, `0px 41px` otherwise; the echo is in the bottom band; nothing is left behind |
| C12 | Enter label | on `/zoo/input`, focus a demo input and activate it (demo only), read the Enter key's text, `Keyboard.Hide()` | the supplied label for that field type; "Enter" after `lgs off` |
| C13 | Motion tokens; nothing runs at rest | `document.getAnimations()` during hover, focus, press, switch and segmented changes on `/zoo`, then 1 s later in every touched window | every duration is a token of §15, iterations 1; **1 s later no animation has `playState === 'running'`** (`finished` forwards fills such as `ItemFocusAnim-*` are allowed); the FocusRing has `animation-name: none` |
| C14 | Reduce Motion, High Contrast | CDP `Emulation.setEmulatedMedia` inside the lock (never Steam's settings) | Reduce: only opacity animates, ≤ 200 ms, no `scale`. Contrast: opaque fills and the 2 px edge; disabled + focus still visible |
| C15 | Performance | `python glass.py perf main --route /settings/system`; `--route /zoo/sliders` while a script sends pointermoves | fps within 5 % of stock; no new frames > 34 ms |
| C15b | glassd budget with the keyboard (after K-G1) | `glassd-out.json` `gpu_ms` EMA over 30 s with the keyboard shown, native mode | median ≤ 2.5 ms (§12.8) |
| C16 | Headset view | `hvgrab` with the keyboard up in native mode (look, then delete) | no outline or dashed line on keys or platter; the echo legible; after K-G6 the platter is visibly behind the keys |
| C17 | glassd | `glassd --once --dump` with the keyboard slab (look, then delete) | one `keyboard` cover, radius 30; after K-G5, `m` ramps 0 → 1 in 350 ms |
| C18 | SteamVR surfaces | `python glass.py audit vr:systemui`; `vrsettings_sweep.js` (SY §0.2, `lab-vr` lock) | sizes ≥ the m-scaled values of §13; option circles 86 at a ≥ 121 pitch; 0 GONE / SHRUNK |
| C19 | Removal | `lgs off`, then check | `ShowTooltip` and the keyboard manager's setter are the originals; no `.lgs-tip` / `.lgs-pill` / echo nodes; no vgp capture listeners; `window.__LGS_CTL` undefined; `/zoo` computes Steam's stock styles |
| C20 | State boards are comparable | sample the glass at the 8 cells' corners of each row of `shots/p2_controls_states.png` | spread ≤ 8 L along every row. **Measured: 5.4 / 4.7 / 3.7 / 3.6 / 6.2 L** (rows 1–5) |
| C21 | Parallax bound for non-interactive pops | `__LGS_SG.dump()` in native mode with a game page showing Play | every `interactive: false` pop: dz / 0.0020833 (CSS px at 45°) < 0.4 × the popped rect's smaller side; capsule pops dz ≤ 0.0271; menu slabs dz ≤ 0.0054 |
| C22 | Low slider values never hit a glyph | on `/zoo/sliders` (probe part `slider`, check `slider_low_values_hit_group`), and in Quick Access › Quick Settings (navigation only) for the four sliders | `elementFromPoint` at the knob centre for v = 0, 0.05 and 0.1 returns the slider group; where `%{ClickableSliderIcon}` exists, the icon's rect does not intersect the track's |
| C23 | Notches and default tick | probe part `slider` (`notch_ticks_under_knob`, `default_tick_same_value`); `settings_sweep.js` lists real sliders that have `DefaultValueIsColorRange` | tick error ≤ 2 px; the default tick at the same value ± 2 px; color-range sliders keep Steam's fill (C2 `theme` mode) |
| C24 | Keyboard masked from the room map (after K-G1) | glassd room-map debug dump with the keyboard shown in native mode (look, then delete) | no key pixels in the map |

---

## 19. Function retention table

These are the functions from the audits that a control, the keyboard, a tooltip or a hover/focus state carries. "Unchanged" means Steam's node and handler, restyled. **Laser** = the controller laser; **Pad** = Steam's FocusNavController. Screens that place these controls are in their own concepts' tables; this table guarantees the controls themselves keep every path.

### 19.1 Settings skeleton and primitives (SY A.1.2, A.1.4)

| # | Function | Phase 2 place | Laser | Pad | Tier |
|---|---|---|---|---|---|
| S1 | Choose a settings page | sidebar row (§10, nav pill) | click the row | Up/Down (selection follows focus) | T1 |
| S2 | Enter a page | first row's control | click any control | Right | — |
| S3 | Move between rows | rows (§10); focus inside a row per C-D14 | point | Up/Down | T1, T2 |
| S4 | Return to the sidebar | — | click it | Left, or B | — |
| S5 | Operate a toggle | switch (§6.1), hit 88 × 80 | click the switch or its extender | A on the switch | T1 |
| S6 | Choose a dropdown value | pop-up (§8.1) → value menu (§8.2) with Cancel; long lists scroll | click the button, a row, Cancel or outside | A, Up/Down + A, B | T1, T2 |
| S7 | Adjust a slider | capsule slider (§7.2), group ≥ 80 px | drag anywhere on the capsule, including over an inert glyph | focus, Left/Right; B Done | T1 |
| S8 | Press a button | capsule or circle (§5) | click | A | T1 |
| S9 | Edit text | text field (§9) → keyboard (§12) | click | A | T1 |
| S10 | Segmented choice | segmented (§8.3), contiguous segments | click a segment | Left/Right + A (FocusRing plate) | T1, T2 |
| S11 | Checkbox | check circle (§6.2), 80 px cell | click | D-pad across columns + A | T1 |
| S12 | Explainer (Y) | legend button with a Y glyph in the bottom ornament (owner: shell) | click the button | Y | T1 |
| S13 | Storage item actions (X / Y) | legend buttons with glyph badges (owner: shell) | click | X / Y | T1 |
| S14 | Scroll a long page | Steam's scroller | wheel / drag | focus moves scroll | — |
| S15 | Leave settings | Back circle (§5), named by `aria-label` and tooltip | click | B | T1 |
| SP1 | Sidebar row | list row 72 + 8 (§10) | click | Up/Down | T1 |
| SP2 | Field row (label, description) | grouped row 80 / 100 (§10) | — | lit via `.gpfocuswithin` (C-D14) | T1, T2 |
| SP3 | Toggle | §6.1 | click | A | T1 |
| SP4 | Dropdown button | §8.1 | click | A | T1 |
| SP5 | Dropdown menu | §8.2 | click a row | Up/Down, A, B | T1, T2 |
| SP6 | Button | §5 | click | A | T1 |
| SP7 | Slider (incl. notched, default tick) | §7.2 / §7.3; notch cells 64; default tick moved 20 px | drag / click a notch | Left/Right | T1 |
| SP8 | Text input | §9 | click → keyboard | A → keyboard | T1 |
| SP9 | Segmented | §8.3 | click | Left/Right + A | T1 |
| SP10 | Checkbox | §6.2 | click | D-pad + A | T1 |
| SP11 | Radio card (Game Recording mode) | single-choice row with a trailing check (§10) | click | Up/Down + A | T1 |
| SP12 | Modal dialog buttons | capsules side by side, Steam's order (`window-nav.md` §5.3) | click; outside = cancel | Left/Right, A, B | T1 |
| SP13 | Read-only info row | information row **80** (§10, R8) | — | focusable as today | T1 |
| SP14 | Slider value box (`S>EditableValue`) | recessed **60 px** capsule, focus ring (§7.2, §9) | click → keyboard | A | T1 |
| SP15 | **Disabled controls** (crash-report rows, Remote Play "Connected", disabled dialog Continue/Confirm, the disabled Feed column) | unchanged and inert; **focus visible** (§4.7) | none (inert, as today) | focus lands and shows; A does nothing (as today) | T1 |
| SP16 | **Default-value marker** on sliders | Steam's `%{DefaultValueTick}`, moved 20 px in, a white marker (§7.2) | look | look | T1 |
| SP17 | **Origin and color-range sliders** | fill from `min(o,v)` to `max(o,v)`; color-range sliders keep Steam's fill (§7.2) | drag | Left/Right | T1 |

### 19.2 SteamVR settings controls (SY A.2)

| # | Function | Phase 2 | Laser | Pad | Tier |
|---|---|---|---|---|---|
| V1 | Refresh-rate radio circles | option circles **60 at an 84 pitch** = 86 / 121 SteamVR px (§7.4) | click | none today (the SteamVR page is laser-only; `settings.md` §4.9 adds a Steam-side path) | T1 `theme/vr` |
| V2 | Sliders with the value on the knob (brightness, laser length, grab acceleration) | capsule slider at m 1.44; the knob always shown with its value (R5) | drag | — (laser only, unchanged) | T1 |
| V3 | Off / On pills | **switches** at m 1.44 (R9; `settings.md`'s T1 method) | click | — | T1 |
| V4 | Dropdowns (a popover in the panel) | pop-up capsule + a thick-glass popover, 104 SteamVR px rows, growing out of the white source (`p2_controls_steamvr.png`) | click | — | T1 |
| V5 | ALL-CAPS buttons, purple advanced fills | title-case capsules; advanced = a purple dot before the label | click | — | T1 |
| V6 | Advanced Settings Hide / Show | segmented control in the bottom ornament (`settings.md`) | click | — | T1 |
| V7 | Keyboard Privacy (Dashboard, Advanced) | a switch like V3; its meaning is explained in §12.3 | click | — | T1 |

### 19.3 Quick Access and bar primitives (SY A.3, A.4, Appendix 2)

| # | Function | Phase 2 | Laser | Pad | Tier |
|---|---|---|---|---|---|
| Q1 | Brightness, Environment Brightness, Volume, Microphone sliders | capsule sliders at m 0.83 (54 popup px); inert glyphs inside the fill (§7.2) | drag anywhere on the capsule | Left/Right | T1 |
| Q2 | Mute (slider icon), where Steam renders `%{ClickableSliderIcon}` | **a separate 54 popup px zone** at the capsule's start, never under the knob; white while muted (C-D13) | click the zone | as today (Steam's own focus order) | T1, T2 |
| Q3 | Wi-Fi, Bluetooth, Airplane, Manual GPU Clock, perf toggles, Motion Smoothing | switches 55 × 32 popup px | click | A | T1 |
| Q4 | System Profile, Performance Overlay Level, Scaling Mode, Scaling Filter, Refresh Rate (notched) | stepped sliders (§7.3), Steam's labels at 15 popup px, title case | drag / click | Left/Right | T1 |
| Q5 | Network row, Bluetooth device rows (disabled ones stay disabled, with focus visible), Add Device, Battery rows | rows (§10) at m 0.83 | click | A | T1 |
| Q6 | Basic View, Reset to Default, Help buttons | capsules (§5) | click | A | T1 |
| Q7 | Quick Access tabs | 52 popup px circles; the selected tab = white .18 (navigation selection) | click | LB/RB, D-pad | T1 |
| B11 | Bar tooltips (names of every bar button) | glass capsule tooltip after 0.8 s (§11) | hover | focus | T1, T3 |

### 19.4 Header, legend, dialogs, menus (SN A.1, A.4, A.6, A.7, A.10)

| # | Function | Phase 2 | Laser | Pad | Tier |
|---|---|---|---|---|---|
| H2 | Start a search | search field (§9) in the toolbar row (`window-nav.md`) | click | Up to the header, focus → keyboard on activation | T1 |
| H3 | Type / edit the query | keyboard (§12), echo "Search", Enter "Search" | click keys | D-pad + A; X delete, Y space, RT enter | T1–T3 |
| H4 | Clear the query | 38 px clear circle, hit 64 × 80 (§9) | click | Backspace / X on the keyboard | T1 |
| F1 | Footer legend actions (X Filter, Y Sort, ≡ Options, A, B) | real capsules with glyph badges (§5) in the bottom ornament | click | the physical button | T1 |
| M1 | Confirm / cancel a dialog | capsules (§5), Steam's order; destructive confirm red; a disabled confirm shows focus (§4.7) | click; outside = cancel | Left/Right, A, B | T1 |
| M3 | Text prompt | field (§9) + keyboard | click | A → keyboard | T1 |
| C1 | Choose a menu item | menu row 72 (`window-nav.md` §5.1) | click | D-pad + A | T1 |
| C2 | Open a submenu | row with a trailing chevron | click | A or Right | T1 |
| C3 | Toggle a checked item | row with a check | click | A | T1 |
| C4 | Dismiss | Cancel capsule, outside | click | B | T1 |
| C5 | Scroll a long menu | Steam's scroller inside the slab, fades and a rail (§8.2) | wheel / drag | D-pad | T1 |
| W3 | Show / hide the keyboard (frame control) | frame-control circle, white while the keyboard is shown | click | Down into the frame controls, A | T1 `theme/vr` |
| W7 | Frame-control tooltips | glass capsules at m 1.33 (§11) | hover | focus | T1 `theme/vr` |
| W8 | "Enter Gamepad Mode" / "Use Laser Mouse" pill | capsule at m 1.33 | click (enter variant) | — | T1 `theme/vr` |
| FR | Every focus look (`.gpfocus`, `.gpfocuswithin`, `%{FocusRing}`, `%{Modal>Focused}`), including disabled + focus | the illumination model (§4) | — | visible on every focusable, 60 % on the first frame | T1, T2 |

### 19.5 Keyboard and text input (SM A.9, P-C6, P-C12)

| # | Function | Phase 2 | Laser | Pad | Tier |
|---|---|---|---|---|---|
| K1 | Raise the keyboard | field activation; frame control | click a field | A on a field | — |
| K2 | Type a character | key (§12.2), lit on hover, white on press | point + click | D-pad + A | T1 |
| K3 | Shift (one-shot), Caps lock | Shift white when on; caps bar | key | key; LT = shift | T1 |
| K4 | Accents | accent bubble (§12.4) | press and hold | hold A, D-pad, A | T1 |
| K5 | Emoji / Steam Chat Items layout | the same tokens; **key block not moved** (C-D18) | key | key; LB/RB categories | T1 |
| K6 | Move the caret | arrow keys | keys | keys | T1 |
| K7 | Delete, Enter, Tab | keys; Enter blue with a context label (§12.5) | keys | keys; X delete, RT enter | T1, T3 |
| K8 | Close the keyboard | close key (`kbdown` glyph) | key | key, or B | T1 |
| K9 | IME candidates, dead keys | IME chips, dead-key states; **key block not moved** (C-D18) | keys | keys; LB/RB candidates | T1 |
| K10 | Buffered text (apps, overlays) | Steam's own `VirtualKeyboardTextBuffer`, restyled as the echo; no echo of ours; keys not moved | look | look | T1 |
| K11 | See what is typed and where (new) | echo row (§12.3), top or bottom band | look | look | T2 |
| K11s | Type a secret without exposing it (new rule) | echo shows dots and a lock for secret fields (C-D17) | look | look | T2 |
| K12 | Space | space bar with a Y badge | key | Y | T1 |
| K13 | Move the keyboard | — | — | ≡ (Steam's RotateWindowPosition) | — |
| K14 | Quick-chat radial menu | — | — | View | — |
| K15 | Trackpad typing | Steam's pointer discs, recoloured; with the move active they move with the key block (C11) | — | trackpads | T1 |
| VK | SteamVR keyboard (apps): preview row, 4 suggestion chips, Done | the same tokens in `theme/vr`; chips as 48 px capsules; Done blue | click | none ("Use Laser Mouse", unchanged) | T1 |
| TF1 | Header search field | §9 (64 px capsule, ring) | click | focus + A | T1 |
| TF2 | Chat compose (`chatTextarea`), focus visible (new) | multi-line field with the ring (§9) | click | focus + A | T1 |
| TF3 | Friend code | §9; echo "Friend Code", Enter "Add" | click | A | T1, T3 |
| TF4 | Media "Search games…" (in a menu) | 60 px field inside the menu slab | click | A | T1 |
| TF5 | Achievements search | §9 | click | A | T1 |
| TF6 | Password / PIN fields (Developer Change User Password, Remote Play PIN, Wi-Fi password) | secure field (§9), masked echo, Enter "Done" (`p2_controls_keyboard-t1.png`) | click | A | T1, T2 |

### 19.6 Tabs and filters that reuse these controls (GP A.5, LA A.4)

| # | Function | Phase 2 | Laser | Pad | Tier |
|---|---|---|---|---|---|
| T1 | Switch game-page tab | segmented control (§8.3), placed by the game-page concept | click a segment | Left/Right (focus selects), LB/RB | T1, T2 |
| F1 | Compatibility filter (4 radio rows) | single-choice rows (§10) | click | Up/Down + A | T1 |
| F2 | 47 checkbox rows, Gamepad Support and Language dropdowns | rows with trailing check circles (§6.2), pop-up buttons (§8.1); the Language list scrolls (§8.2) | click | Up/Down + A | T1 |
| F3 | Store tags / Friends text search | text field (§9) | click → keyboard | A → keyboard | T1 |
| F4 / F5 | Reset; Save as Dynamic Collection | capsules (§5) | click | A | T1 |
| F6 | Close | Back circle / outside | click | B | T1 |

No function in these tables loses its laser path, and none loses its gamepad path. Several gain one or become easier:
- S12 and S13 become visible buttons for the laser;
- K11 is the echo;
- TF2 gets a visible focus;
- SP15 and FR now show focus on disabled controls;
- Q2 can no longer be hit by accident at low volume.

---

## 20. Risks and open questions

| # | Risk | Mitigation |
|---|---|---|
| 1 | Check-circle columns at 80 px may misalign Steam's sticky `%{CheckboxHeaders}` (CS3) | Widen the header columns by the same rule; fallback: Steam's 60 px pitch with non-overlapping extenders |
| 2 | Moving the keyboard's key block (on INV-H's no-touch list) could desynchronise trackpad pointer discs, or collide with the IME, emoji or buffered rows | Scoped by C-D18 (P-C12 located all three); C11 and C11c check the hit areas and the scope; fallback: the echo in the bottom band, keys unmoved |
| 3 | The echo reads the main window's focused field; a field in another window would not echo | Echo only when `m_sOpenForOverlayKey` is the main window's key; otherwise the field name only |
| 4 | `pointermove` tracking in every window costs main-thread time in SharedJSContext | rAF throttle, one element per frame, nothing while idle; C15; disable the tracker if fps drops |
| 5 | The ShowTooltip and Enter-label wrappers patch Steam functions in memory | Fail closed (one candidate found by source text), restore on `lgs off` (C19); a lost wrapper degrades to Steam's behaviour |
| 6 | Keyboard skins: a non-default skin keeps Steam's look | Intended; rules are scoped to `.DefaultTheme` |
| 7 | Keys are 1.72° tall, under the 2.45° target, and cannot grow (the quad is fixed) | The 2.5° width, the lit hover and the echo reduce misses; a larger keyboard needs a SteamVR overlay size change (out of scope) |
| 8 | Switches crowd labels in 300 px Quick Access cards | m-scaled 55 × 32 popup px; `control-center.md` uses circular toggles in its own tiles |
| 9 | Plus-lighter light over very bright room glass could clip | Glass sits in L 55–110 (D2 §6.3); light adds ≤ +.30; C6 and hvgrab review |
| 10 | The selection pill (T2) must track tab size changes after font loading | Recompute on `ResizeObserver`; no travel animation for size-only changes |
| 11 | `animation: none` on the FocusRing removes Steam's flash; if Steam ever listened for its `animationend`, behaviour could change | A source scan for `onAnimationEnd` near the FocusRing component before shipping (part of C13's setup); none is known |
| 12 | The keyboard platter pushes glassd past its 2.5 ms budget (live already 1.9–2.5 ms) | C15b gate; drop the window slabs while the keyboard is open; else T1 |
| 13 | Non-interactive primary pops put the hit 13 px from the drawn capsule at 45° | Bounded by C21 (< 40 % of the capsule); the moving light marks the real hit point; no pop for capsules under 70 px |
| 14 | Quick Access labels in other languages may be longer than the English ones measured | The T2 crowding rule (§7.3) keeps the current and end labels; C4 runs with the user's language |
| 15 | Sibling concepts carry older numbers (`settings.md` option circles 104/116; `control-center.md` always-white glyph zone) | R10 and R12 state the vocabulary's values; the coordinator reconciles |
| 16 | Steam may stop rendering `%{ClickableSliderIcon}` (P-C9 found none today), or render it elsewhere | C-D13 keys the zone on the class; with no class, the glyph is inert inside the fill and the slider still works |

---

## 21. Critique responses (revision 2)

| # | Critique point | Response | Where |
|---|---|---|---|
| 1 | **C4 contradicts the spec** (64 px info rows, a 48 px value box, 56 px segments 4 px apart, 64/80 option circles, 38 px circles, a 77 px switch hit) | **Accepted.**<br>• Info rows are now 80 (R8).<br>• The value box is 60.<br>• Option circles are 60 at an 84 pitch (R10).<br>• The switch extender is −12 px (87.5 × 80.5, re-proven).<br>• Segments are contiguous 60 px with their own criterion.<br>• Mini and clear circles have extender criteria.<br>The exemption table is §18.1 | §5, §6.1, §7.2, §7.4, §8.3, §9, §10, §18.1 |
| 2 | **C5** misses the check-circle glyph ring and Steam's `0 0 0 4px` toggle hover ring | **Accepted.** C5 now rejects any `0 0 0 Npx` spread shadow except the named glyph and the field ring; Steam's toggle hover ring is removed explicitly and tested with a synthetic hover | §6.1, §6.2, C5 |
| 3 | **C12/C13**: `getAnimations()` is never empty (`ItemFocusAnim-*` forwards) and the FocusRing pulse still runs | **Accepted.**<br>• The tests count only `playState === 'running'`; P-C11 measured 2 `finished` and 0 `running`.<br>• The FocusRing and its pseudo-elements get `animation: none`.<br>• Steam's slider pop keyframe was already removed | §4.5, §15, C13 |
| 4 | **C3** will flag text Back/Close buttons that become circles | **Accepted.** A C3a allowlist checks that `aria-label` keeps the stock text, the hit works and the tooltip names it | §5, C3a |
| 5 | **C6**: the tools are too slow for a 30 ms shot, and the alphas give 20–35 %, not 60 % | **Accepted.**<br>• The focus contrast now lives only in the two pseudo-elements, which enter from opacity .6, so the first frame is 60 % by construction.<br>• C6 pauses animations at t0 after `DispatchVirtualButtonClick(10)`, reads the computed opacity, then shoots.<br>• P-C11 ran this on the device: 0.60 at t0, 1.00 at 700 ms | §4.1, §4.3, C6 |
| 6 | **C7** never observes Steam | **Accepted and run.** A passive capture listener during `L.pad('down')` saw `vgp_onbuttondown` with `button: 10` (P-C11) | §4.4, C7, P-C11 |
| 7 | **Disabled controls can take focus but would show none** | **Accepted and proven** (P-C7: focus on `DialogButton … Disabled … gpfocus`). §4.7 gives every control a visible disabled + focus look without `opacity` on the element; C6 includes disabled cases; mockups `system-disabled` and `states` | §4.7, C6, P-C7 |
| 8 | **The mute glyph overlaps the knob at low volume** | **Accepted, option (a).**<br>• A clickable mute icon gets its own zone before the track and is a toggle (white while muted).<br>• Inert glyphs sit inside the fill with `pointer-events: none`.<br>• 0 shows no white.<br>• C22 tests the knob centres at v = 0, 0.05 and 0.1 (passed on `/zoo`).<br>• P-C9 found that Quick Access renders no clickable icon on this build, so the zone is keyed on the class | §7.2, C-D13, C22, `p2_controls_quickaccess.png` |
| 9 | **Origin-filled sliders, the default tick, notch alignment unproven** | **Accepted and proven.**<br>• The fill runs from `min(o,v)` to `max(o,v)`.<br>• Color-range sliders keep Steam's fill.<br>• P-C8 found the notches 17.8 px and the default tick 20 px off with a 64 px knob; with the two corrections both are exact.<br>• Labels: zoo labels fit 270 px (device), and Quick Access's real labels fit at 15 popup px (render: 0 overlaps, 10.7 px smallest gap) | §7.1–7.3, P-C8, P-C9, C23 |
| 10 | **Moving the key block can break the IME and emoji rows** | **Accepted.** The source scan (P-C12) found the IME row inside the key rows, the emoji panel, and also Steam's own buffered text row. The move is scoped off for all three; C11c tests the scope with temporary decoy nodes | §12.1, §12.2, C11c, risk 2 |
| 11 | **The echo ignores Keyboard Privacy and does not mask PIN or code fields** | **Partly accepted.**<br>• Masking: dots for password, one-time-code and PIN fields, numeric fields in dialogs, and secret dialogs; tested by C11b.<br>• **Keyboard Privacy: rejected as a gate.** P-C10 shows it stops games from streaming controller poses while the keyboard is in use; it does not hide displayed text, and the field's own text is already on the main window. If SteamVR ever gives it a display meaning, the module reads it read-only and shows the field name only | §12.3, C-D17, P-C10, C11b |
| 12 | **T4 clicks on crops are only PLAUSIBLE** | **Accepted.**<br>• Menus and pop-up sources ship flat (a glassd slab at 2 mm for the material only, 2.6 px parallax).<br>• Primary capsules ≥ 70 px may pop ≤ 10 mm without being interactive. The parallax (13 px at 45°, 18.6 % of 70 px) is computed in §14 and bounded by C21.<br>• Interactive depth returns after the SP §12 wearer check | §14, C-D16, C21 |
| 13 | **The T5 keyboard platter needs new glassd work: a tracked surface, a feed-mask rect, the rim fix; none is planned** | **Accepted.**<br>• §12.8 plans K-G1 to K-G6: report the surface, the mask check, the GM v2 material (the rim fix of native-e2e #2 is done in GM, the thin-slab dashed lip unchecked), native keys, materialize, and the later 10 mm gap.<br>• A performance gate is added (C15b).<br>• The tier is [PLANNED], and T1 ships until it passes | §12.8, §16, C15b, C16, C17, C24 |
| 14 | **The mockups are an idealized gallery** | **Accepted.** Eight real-case renders are added:<br>• the Notifications matrix;<br>• Quick Access at m 0.83 with Steam's real labels;<br>• SteamVR at m 1.44;<br>• the 64-row Timezone menu;<br>• the CSS-only keyboard;<br>• the System page with focus on a switch in a row, a pop-up in a row and a disabled row | mockups table, §19 |
| 15 | **The state comparison row sits over a backdrop from L 89 to L 20** | **Accepted.** `controls-states.html` is now a full state matrix, and the storyboard moved to `controls-motion.html`. Both sit over a dim evening room, with window glass keeping 30 % of the room's swing as GM v2 does. The measured spread is 3.6–6.2 L along each row (C20) | C20, `p2_controls_states.png`, `p2_controls_motion.png` |
| 16 | **Focus on a switch or pop-up inside a settings row is the weakest cue** | **Accepted.** C-D14: in a single-control row the row carries the focus and the control is lifted; in a multi-control row the control carries a bloom. Shown on the real System page (`system`, `system-popup`) and in the Notifications matrix | §4.3, C-D14 |

---

## Files

| File | What |
|---|---|
| `docs/phase2/concepts/controls.md` | This concept |
| `docs/phase2/concepts/controls-probe.js` | Device probe: parts `hit`, `slider` (incl. notches, default tick, low-value hits, label fit), `disabled`, `vgp`, `firstframe`, `kbsrc` |
| `docs/phase2/mockups/controls.css` | The vocabulary as CSS on top of the kit (revision 2 classes at the end) |
| `docs/phase2/mockups/controls-real.css`, `controls-real.js` | The real-page cases: the System page, the Notifications matrix, the Timezone menu, the Quick Access popup |
| `docs/phase2/mockups/controls-icons.js`, `controls-gallery.js`, `controls-keyboard.js` | Extra symbols (incl. mute states, battery, help), the gallery sidebar, the keyboard builder |
| `docs/phase2/mockups/controls-{system,system-popup,system-disabled,timezone,notifications,quickaccess,steamvr,keyboard-t1,states,motion,buttons,switches,switches-t1,pickers,fields,lists,tooltips,keyboard,keyboard-pad,keyboard-dim}.html` | Mockups (20) |
| `shots/p2_controls_*.png` | Their renders (20) |
