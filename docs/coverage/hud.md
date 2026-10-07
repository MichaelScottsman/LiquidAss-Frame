# HUD coverage: tooltip, volume HUD, floating footer, toasts, VR keyboard

Area `hud`. File: `theme/35-hud.css`. Verified live on 2026-10-06 (Steam restarted during the session; overlay ids `7088000N`). All shots are in `shots/` at 1.5x; `*_rooms.png` sheets composite the same transparent PNG over a dark room, a mid-grey room, a bright wall and a mixed scene (top to bottom), which is how the quads read in the headset.

## Design summary

All five surfaces are standalone quads with nothing in-page behind them, so they all use **panel glass**: `--lgs-panel-sheen` over `--lgs-panel-bg`, `--lgs-panel-rim`, no backdrop blur and no outer shadow.

| Surface | Treatment |
|---|---|
| Tooltip | A panel-glass capsule (`--lgs-r-capsule`), `--lgs-text-1` with a text shadow. It materializes on mount (`lgs-materialize`, 220 ms spring); Steam has no fade there. The marquee mask, transform, animation and inline vars are untouched. |
| Volume HUD | A panel-glass capsule. The track is a dim `--lgs-fill-3` capsule with `--lgs-track-depth`. The fill is white (`--lgs-slider-fill` via Steam's `--left-track-color`). Steam's `SliderTrack::before` is only recoloured and rounded; its inset and width stay Steam's. The speaker glyph is `--lgs-text-1` with a soft drop shadow. It materializes on mount. |
| Floating footer | Steam's decorative `filter: brightness(.6) drop-shadow(...)` is replaced by a compact panel-glass capsule behind the legend, so glyphs and labels show at full brightness. A 6 px inline padding on `%{FloatingVRFooter}` lets the round ends clear the first glyph and the last label, and SteamVR's clip rect grows with it (audited). The shell's in-window `#Footer::after` Liquid Glass capsule is switched off on this surface (`content: none`): the surface has nothing to blur, and two capsules would stack. It materializes on mount. |
| Toasts | `%{ShortTemplate}` becomes a panel-glass card with `--lgs-r-panel`: a capsule on the 40 px one-liner, a rounded rect on two-line cards. Steam's 20 px black halo and the VR grey outline are replaced by the inset rim, which reads over any room. The logo fills the round end: avatars and app icons are circles, concentric with the card. The friend status strip is a small rounded pill without its black edge. Title is `--lgs-text-1`, body `--lgs-text-2`, the count is a `--lgs-blue` badge. Hover is an inset `--lgs-hover-fill` layer that fades in 140 ms. `.gpfocus` gets the focus fill and `--lgs-focus-ring`. Incoming call is green-tinted panel glass (see notes). The enter/exit animations, `--toast-duration`, position and inset are untouched. |
| VR keyboard | **Default skin only**: the CSS variables and rules are scoped to `%{Modal>Keyboard}%{Modal>VRFloatingKeyboard}.DefaultTheme`, so user-chosen skins keep working. The slab is panel glass with `--lgs-r-panel`; the four corner keys follow the slab's curve (`r-panel` − 4 px, the inset). Keys are `--lgs-fill-2` fills with `--lgs-r-small` and an inner top rim; special keys (Tab, Caps, Shift, Backspace, arrows, emoji, close) use `--lgs-fill-3`. The focused or laser-hovered key (`%{Modal>Focused}`) is bright white with a dark label. Pressed (`%{Modal>Touched}`) is white, pushed in (`scale: var(--lgs-pressed-scale)` plus inset depth); Steam's `Touched::after` shine stays. Caps/Shift locked (`ToggleOn`) is the white selected pill; one-shot uses `--lgs-pressed-fill`, bold. Enter is the one tinted key. The long-press accent row is a thick-glass popover that really blurs the keys under it, with a white pill on the focused accent. Trackpad pointers are a soft white disc with a dark ring. In buffered mode, the text preview row is the upper part of the same slab (top corners on the buffer, square seam). |

## Screens and states

| Screen / state | How to reach | Before | After | Audit | Notes |
|---|---|---|---|---|---|
| Tooltip, normal | `shot tooltip` with `--pre` = synthetic `mouseenter` on `%{QuickAccessButton}` + `mouseleave` timer (inventory §1.2) | `hud_tooltip_before`, `_rooms` | `hud_tooltip_after`, `_rooms` | `audit tooltip`: 0 controls, 1 text run, **0 issues**, 0 moved | White on panel glass: about 5.9:1 over a bright room |
| Tooltip, marquee (overflow) | Store call `vrPooledPopupStore.ShowTooltip(el, longText, W, x=>x)` + `h.hideTooltip()` timer, shot on the free host (`tooltip.70880002`) | `hud_tooltip_marquee_before` | `hud_tooltip_marquee_after`, `_rooms` | Same element as above | Full-width capsule; Steam's mask fades stay inside it |
| Volume HUD | `--pre` dispatching `req(10652).F5.m_VolumePressedSubscribable` on an interval (inventory §2.2). The volume is never changed | `hud_volume_before`, `_rooms` | `hud_volume_after`, `_rooms` | `audit volumelevel`: 3 controls, 0 text, **0 issues**, 0 moved | |
| Floating footer, real legends ("Cycle view" + LG/RG "Laser Mouse") | Present whenever the dashboard has no focus; `shot floatingfooter` with no injection | `hud_footer_real_before`, `_rooms` | `hud_footer_after`, `_rooms` | `audit floatingfooter`: 0 controls, 1 text run, **0 issues**, 0 moved (padding audited) | Stock dims everything to 60%, which is illegible over a grey room |
| Floating footer, two legends via injection | Inventory §3.2 recipe. It only injects when no real legends exist; the real ones were up, so this shot shows real content | `hud_footer_two_before` | `hud_footer_two_after` | as above | `m_defaultActions` verified back to `[0,1,8,9]` |
| Toasts: one-line (Clip Saved), friend online, friend in-game, two-line (Frame promo), app logo + unread count, incoming call, warning, controller focus | Static mock with Steam's exact classes, built in a detached `div#hud-toast-test` in the **notifications document** and removed by timer (never Steam's notification stores). The window cannot paint while SteamVR hides it, so the visual is a headless-Chrome render of the mock's live computed styles (serialized per element) over four rooms. Font falls back to Arial locally | `hud_toast_before` (inventory, Steam logo one-liner) | `hud_toast_variants_after` | `audit notifications` with the mock: 8 controls, 16 text runs, **0 issues**, 0 moved | Builder: inventory §4.3, targeting the notifications document. Hover is CSS only |
| Toast hover (laser) | CSS only (`:hover` can't be faked statically) | n/a | n/a | n/a | Inset hover-fill layer over the glass, 140 ms |
| Keyboard at rest + laser hover (`Focused` on "g") | Main window `SteamClient.OpenVR.Keyboard.Show()` + bubbling `mouseover` on `[data-key="g"]`, Hide timer (inventory §5.2). No key is pressed | `hud_keyboard_before`, `hud_keyboard_hover_before`, `_rooms` | `hud_keyboard_hover_after`, `_rooms` | `audit keyboard`: 66 controls, 6 text runs, **0 issues**, 0 moved | Corner keys are concentric with the slab |
| Keyboard controller focus | `Show()` then `L.pad('right', 2)`: virtual focus moves g → j and the hit area gets `.gpfocus`. Navigation only | n/a | `hud_keyboard_padfocus_after` | as above | Unmistakable white key. The trackpad pointers (white discs) are visible on d / l |
| Keyboard pressed (`Touched`), Caps `ToggleOn`, Shift `ToggleOneShot`, long-press accent row with focused accent, buffered text row | Static deep clone of the live keyboard in `div#lgs-hud-kbmock` (keyboard document, removed by timer). States are added to the clone's classes only; the real keyboard is never pressed. Scene backdrop inside the mock | n/a (not capturable stock) | `hud_keyboard_states_after` (scene, buffered), `hud_keyboard_buffered_after` (grey room) | n/a (clone excluded from audits) | |
| Emoji / Steam Chat Items layouts, dead keys, IME rows | CSS variables only (`--key-emoji-*`, `--key-deadkey*`), emoji/item keys rounded | n/a | n/a | n/a | Switching layout needs a key press |
| Other keyboard skins (Pumpkin, NightShift, DEX …) | Untouched by design (scoped to `.DefaultTheme`) | | | | |

## Performance

None of the HUD surfaces scroll. The keyboard (the heaviest: 66 keys with transitions) was measured shown, theme off vs on, with `perf keyboard --seconds 2`:

| | fps | median | p95 | worst | long frames | backdrop-filters |
|---|---|---|---|---|---|---|
| theme off | 89.9 | 11.1 ms | 11.2 ms | 11.2 ms | 0 | 0 |
| theme on | 89.9 | 11.1 ms | 11.2 ms | 11.2 ms | 0 | 0 |

- The only backdrop-filter in this area is the keyboard's long-press accent row, which exists only during a long press.
- There are no infinite or filter animations.
- Transitions run only on state changes: key focus and pressed fills, the toast hover layer, and one-shot materialize on mount for tooltip, volume and footer.

## Status

`python glass.py status`: no unresolved or ambiguous tokens, no skipped files.

## Notes and decisions

- **Enter tint.** `--lgs-tint-primary` (#0A84FF at .82) gives white 12 px "Enter" only about 4.1–4.3:1 over a bright room, so the audit flags it. The key uses `color-mix(in srgb, var(--lgs-blue) 82%, var(--lgs-text-on-selected))`. That is the same blue laid over the darkest ink and made opaque, and it measures 4.7:1. See the requests.
- **Incoming-call toast.** Steam's bright green fill measures about 2:1 with white text, and tint-play as a whole fill measures 1.5:1 over a bright room. The card is panel glass with a 32% `--lgs-tint-play` wash (about 5:1), so it still reads green.
- **Hidden-window transitions.** CSS transitions don't advance in the hidden notifications window. A `background-color` transition on the card made the audit read the start value of the theme switch and flag false CONTRAST. The card background therefore never transitions; hover fades through an inset box-shadow layer instead.
- **Toast audit naming.** The toast mock is named `hud-toast-test`, not `lgs-…`, because the audit skips `[id^="lgs-"]`.
- **Stuck tooltips.** During the session, other steps left bar tooltips stuck: ids 48, 49, 51, 53 and 55 (Launch Program, Steam, Quick Access Menu, Playspace Menu, Streaming Status). They filled the 3-host pool and showed under the user's bar. I cleared them with `mouseleave` on their own elements after they had been up for several minutes.
- **Audit `--pre` and tooltips.** For tooltip audits, prefer the store call with `h.hideTooltip()`: a synthetic `mouseenter` pre can leave a stuck tooltip.
- **All triggers verified reverted.** Keyboard closed (`m_bIsOpen=false`), `m_defaultActions` back to `[0,1,8,9]`, both mocks removed, no tooltips of mine left.

## Not styled / not verifiable, and why

- **Real notification toasts.** Not triggered: the only paths (developer test notifications) hit the real toast and tray queue, play a sound and show a SteamVR notification. Styled from the inventory's CSS map and verified on the static mock. The `notifications` surface cannot be screenshotted, because CEF doesn't paint it while hidden.
- **Volume muted / 0% glyph and drag state.** These need a volume change, which is forbidden. The glyph is recoloured the same way. `VolumeSliderLabel` (non-VR only) and `VolumePopinHidden` (unused in VR) are left stock.
- **Keyboard emoji / Steam items layouts, dead keys, IME rows.** Variables only; reaching them needs key presses or layout switches.
- **The non-VR in-window keyboard** (`%{Modal>Keyboard}` without `VRFloatingKeyboard`) is out of scope and left stock. The SteamVR keyboard page (`vr:keyboard`) belongs to `theme/vr/`.
