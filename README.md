# Glass Shell: Liquid Glass for the Steam Frame's VR interface

Glass Shell re-skins the Steam Frame's whole VR interface in Apple's glass design language: visionOS window glass for the dashboard window, Liquid Glass for everything that floats. That covers:

- the library, game pages and settings
- friends, the dashboard bar and every bar popup
- frame menus, tooltips, the volume HUD, toasts and the keyboard

It is a **look only**. Every button, menu, route and controller-focus path is Steam's own, untouched.

## Turn it on and off (in the headset)

1. On the dashboard bar, press **+**.
2. Under **Launch Program**, pick **Liquid Glass**.

A glass toast confirms "Liquid Glass · On". Do the same again to turn it off.

## Nothing persists

**The theme is never written to disk.** `lgs` injects the stylesheet into the *running* Steam client through its local devtools socket (`127.0.0.1:8080`; Steam on the Frame runs with `-cef-enable-debugging`). Any of these brings back the stock UI:

- reboot the headset
- restart Steam
- launch **Liquid Glass** again from **+**

Nothing starts at boot. There are no systemd units, autostart entries or Steam file patches.

Only two things stay installed, so the toggle is there after a reboot, plus one file of your own:

| Path | What it is |
|---|---|
| `~/.local/share/applications/glass-shell.desktop` | The "Liquid Glass" entry in + › Launch Program |
| `~/.local/share/glass-shell/` | The toggle script and the theme files it reads |
| `~/.config/glass-shell/tune.json` | Your glass settings from the paintbrush button on the bar (colour, intensity, refraction, frost, highlights). Written only when you change them; **Reset to default** in that panel deletes it. The one exception to "nothing persists", by request |

`python glass.py uninstall` removes all three.

## From the PC

```bash
python glass.py install        # copy to the headset and add the launcher
python glass.py on | off | toggle | status
python glass.py dial 0.7       # glass intensity: 0 = clearest, 1 = most opaque (saved with your glass settings)
python glass.py uninstall
```

On the headset itself, `~/.local/share/glass-shell/device/lgs on|off|toggle|status|dial V` does the same.

## How it works

| Piece | Role |
|---|---|
| `device/lgs_core.js` | Runs inside Steam's SharedJSContext. Adds one `<style>` (and hidden SVG defs) to every gamepadui window through `g_PopupManager`, follows new popups, and removes everything on `off` |
| `device/lgs_index.js` | Steam's class names are hashed. The theme is written against readable names (`%{BarSurface}`, `%{*GamepadDialogContent>Field}`) that are resolved at injection time from Steam's own webpack CSS modules, so the theme survives client updates |
| `theme/*.css` | The look, split by area. `00-tokens.nowrap.css` holds the materials (window glass, panel glass, Liquid Glass, thick glass), states, radii and motion. See `docs/DESIGN.md` |
| `lab/` + `glass.py` | Development tools: navigate, open menus, screenshot any surface (it renders even when nobody wears the headset) and **audit** stock against themed for hidden, shrunk or unclickable controls and lost contrast. See `docs/LAB.md` |

## Docs

| File | What's in it |
|---|---|
| `docs/DESIGN.md` | Materials, states, components, guardrails |
| `docs/LAB.md` | Tools, token syntax, rules for working on the live UI |
| `docs/inventory/*.md` | Every surface, route and sub-menu, mapped |
| `docs/COVERAGE.md` | What was restyled and verified, screen by screen |
