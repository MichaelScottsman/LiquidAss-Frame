# Glass Shell lab guide (for anyone, human or agent, working on the theme)

Glass Shell restyles the Steam Frame's VR interface. That interface is Steam's gamepadui running as SteamVR overlays. It does this by injecting CSS into the running Steam client over its devtools socket (`127.0.0.1:8080` on the headset, enabled because Steam runs with `-cef-enable-debugging`). Nothing is persisted: a Steam restart or a reboot always brings back the stock UI.

All commands run from `glass-shell/` on the PC:

```bash
python glass.py <command>
```

The driver reaches the headset over SSH via the `steam-frame-ssh` skill helper.

## Surfaces

Each surface is a separate Steam popup window and a separate SteamVR overlay quad with per-pixel alpha. Transparent pixels show passthrough (the room) or the running game.

| Surface | Size (CSS px) | What it is |
|---|---|---|
| `main` | 1280×720 @1.5x | The dashboard window: library, store chrome, settings, friends, game pages, running-game page. Most routes live here |
| `bar` | 1200×80 | The dashboard bar (dock): Steam button, open windows and apps, **+** (Add Desktop Window / Launch Program), small buttons, Quick Access (clock and status), avatar |
| `barpopup` | 300×1024 | Popups that open from bar buttons, such as the + list and other bar menus |
| `frame.menu` | 300×800 | Menus that open from window frames, e.g. the frame controls under the main window |
| `floatingfooter` | 600×40 | Button legend under the window, such as "LB RB Hide Laser Mouse" |
| `tooltip` | 400×40 | Bar tooltips |
| `volumelevel` | 250×100 | Volume HUD |
| `notifications` | 340×80 | Toast notifications |
| `keyboard` | 854×280 | VR keyboard |

`python glass.py surfaces` lists them live. New popup ids appear over time (`frame.menu.6256000N`); aliases match by prefix.

## Tokens instead of hashed classes

Steam's class names are hashed (`_2Y_MrEdtYx5M51OJoFSLB`). Theme CSS uses readable tokens that resolve at injection time from Steam's webpack CSS modules, so they keep working after Steam updates.

| Form | Meaning |
|---|---|
| `%{Name}` | The class exported as `Name` (must be unique) |
| `%{Anchor>Name}` | `Name` from the module that also exports `Anchor` |
| `%{*Anchor>Name}` | Every variant. Steam ships several builds of some modules (e.g. 4 gamepaddialog builds); expands to `:is(.a,.b,…)` |

Literal classes Steam uses unhashed are written as normal CSS: `.gpfocus`, `.gpfocuswithin`, `.Panel`, `.Focusable`, `.GamepadMode`, `.BasicUI`, `.VRDashboardBarSmallButton`, `.VRDashboardBarSmallButtonActive`.

To find tokens:

- `python glass.py outline SURF [--route R] [--sel S] [--max N]` prints the live DOM with every class already written as its token, plus rects, background hints and text. Copy tokens from it.
- `python glass.py classes REGEX` searches readable names (e.g. `classes "^Field"`).
- `python glass.py status` lists tokens that did not resolve. **Your files must have none.**

## Theme files

`theme/*.css` are bundled in name order.

- Files **not** named `*.nowrap.css` are wrapped as `html.lgs-on { … }` using CSS nesting (Chrome 126).
  - Write normal selectors; they become `html.lgs-on <selector>` and gain `(0,1,1)` specificity over Steam's rules.
  - To target `<html>` itself use `&`; to target `body` write `body.GamepadMode …`.
- `@keyframes`, `@font-face` and `@property` must live in `*.nowrap.css` files (they cannot be nested).
- `theme/defs.svg` (optional) is inserted into every window as hidden SVG defs, for `filter: url(#id)`.
- `00-tokens.nowrap.css` holds the design tokens (colours, materials, radii, motion). Use its variables; don't hard-code new colours.

## The edit → see loop

```bash
python glass.py sync                                   # upload theme/ (and tools)
python glass.py shot main lib_home_after --route /library/home --theme on
python glass.py shot main lib_home_before --route /library/home --theme off
```

Then open `shots/lib_home_after.png` with the Read tool. Screenshots are 1.5× (1920×1080 for `main`) and transparent where the overlay is transparent. Transparent areas look black or checkered, but in the headset they show the room.

- `shot SURF NAME` brings that surface to the front (it renders even when nobody wears the headset), optionally navigates (`--route`), runs JS (`--pre`), waits `--settle` seconds (default 1.2) and captures.
- `--theme on|off` reloads or removes the theme inside the same locked step. Use `on` for after-shots and `off` for before-shots.
- **`--pre` JS** runs in Steam's SharedJSContext with `L` = the lab helpers:
  - `L.nav('/route')`, `L.back()`, `L.route()`
  - `L.click('bar', '%{AddWindowButton}')`: a synthetic pointer click that opens menus and popups
  - `L.q(surface, sel)`, `L.qa(surface, sel)`, `L.surface('main')` (the window object)
  - `L.clickText(surface, sel, 'Label')`: click the match whose text is `Label`
  - `await L.pad('down', 3)`: move **controller focus** like a D-pad (up/down/left/right only), then return `L.focused()`. Focus states are only visible this way: DOM `focus()` does not move Steam's focus. It refuses left/right while a slider is focused, because that would change its value. Still avoid left/right on settings pages
  - `L.focused()`: where `.gpfocus` is on each surface
  - `await L.sleep(ms)`
  - Chain with commas: `--pre "L.nav('/settings'), L.click('main', '%{Some>Tab}')"`
  - Or use an async IIFE when you need waits: `--pre "(async()=>{L.click('bar','%{AddWindowButton}'); await new Promise(r=>setTimeout(r,500)); return L.route()})()"`
- `python glass.py audit SURF [--route R] [--pre JS]` diffs stock against themed for every interactive element and text run:
  - **GONE / HIDDEN / SHRUNK / UNCLICKABLE**: functionality regressions. These must be zero.
  - **CONTRAST**: text that became less legible than stock and is below 4.5:1 (3:1 for large text), computed over a grey, a bright and a dark room behind the glass.
  - `moved >24px`: informational.
- `python glass.py styles SURF "SELECTOR"` prints key computed styles of matches.
- `python glass.py js "EXPR"` evaluates in SharedJSContext with `L`.

### Sharing the headset

The UI is live and shared with other agents and with the user, who may be wearing the headset.

- **Use only the atomic forms:** `shot --route/--pre`, `outline --route`, `audit --route/--pre`. They hold a device lock across navigate, act and capture. Never assume the route survives between two commands.
- `sync` uploads the whole `theme/` folder from this PC, so it includes other agents' in-progress files. That's expected.
- Prefix screenshot names with your area (`bar_…`, `lib_…`, `set_…`).

## Hard rules (functionality must be retained)

**Styling: only look-and-feel properties.** Use colour, background, border, radius, shadow, backdrop-filter, filter on decorative parts, text colour/shadow, small padding tweaks, and transitions on state changes.

**Never do these to Steam's elements:**
- Never `display:none`, `visibility:hidden`, `opacity:0` (or near 0), `pointer-events:none`, `content-visibility`, or `clip-path` that hides content.
- Never change `position`, `overflow`, `width`/`height`, `flex`/`grid` layout of containers, `z-index` stacking that could cover controls, or transforms that Steam animates or positions with.

**Our own pseudo-elements** need `pointer-events:none`. Only add them where Steam doesn't already use that pseudo-element; check with `styles` first.

**Interaction states must stay distinguishable:**
- Focus (`.gpfocus`, which is how controller and laser focus show) must be obvious: fill plus ring.
- Selected states use the white "selected" fill.
- Disabled states stay dimmer.
- Hover must stay visible.

**Hit targets never shrink.** The audit's SHRUNK must stay empty.

**Text must stay legible on glass.** The audit's CONTRAST must stay empty for your area.

**Performance:** the headset GPU is shared with the compositor.
- `backdrop-filter` only on floating elements over in-page content (menus, sheets, headers, capsules). Never on big scrolling regions, list rows or every card.
- No `filter` or `backdrop-filter` animations and no infinite animations.
- Animate opacity and the independent `scale`/`translate` properties only. Don't animate `transform`, which Steam uses for positioning.

## Things you may and may not do on the live UI

**Allowed:**
- Navigating routes.
- Opening menus, popups, tabs and dialogs with `L.click` to see them.
- Closing them with `L.back()` or by navigating away.
- Screenshots.
- Theme on and off.

**Never:**
- Launch games or programs.
- Change settings values: toggles, sliders, dropdown choices.
- Confirm dialogs.
- Send messages or friend actions.
- Purchase anything.
- Sign out.
- Power actions: shutdown, restart, suspend.
- Exit or stop a game.
- Uninstall or delete anything.
- Touch `/dev/video99` or the camera.

If a menu item would perform an action, look at it, don't click it.
