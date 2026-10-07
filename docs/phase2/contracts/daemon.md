# Contract: the daemon `lgs-shell` (P8)

Owner: **P8** (`device/lgs_shell.py`, `device/lgs_vr.py`, `device/lgs_vr_core.js`, `device/shell_ext/__init__.py`). Readers: **P1** (`lgs on` / `lgs off` call `start()` / `stop()`), **P6** (report fields passed to glassd; acks), **P7** (scene-graph spec; `motion.js` prepended), **P9** (`glassd.json` writer), **P10** (`native-session`, `shell` passthrough), **C1a** (geometry for the tab bar), **C3b** (`page`, CC15), **C5b** (`vrbind` action plugin, `systemui.nowplaying.js`), **C6b** (`systemui.settings.js`), **V1** (`native=auto`, `defaults.json`), **V2**.

Status column: **live** = running on the Frame from the synced tree, **built** = in the tree, tested offline only, **planned** = specified, not built. The evidence log `docs/phase2/wp/P8.md` says what passed on the device.

Everything here stays **transient**: the daemon is the `systemd-run --user --collect` unit `lgs-shell` (`python3 -B`, no bytecode written); it writes only under `/dev/shm/lgs` and `/tmp/lgs`; `lgs off` stops it at once; a theme off without `lgs off` makes it **dormant**, and it exits after the grace, at once after a Steam restart, or after 120 s without Steam (§1); nothing it does survives `lgs off`, a Steam restart or a reboot (its binding globals included).

---

## 1. Lifecycle (P1 calls these)

```python
import lgs_shell
lgs_shell.start(native=None|'auto'|'on'|'off'|True|False, stay=False, glassd=GLASSD_BIN, glassd_args=None) -> str
lgs_shell.stop() -> 'stopped' | 'not running'
lgs_shell.status() -> dict      # unit + /dev/shm/lgs/shell.json
lgs_shell.brief(status) -> dict # one-level summary for `lgs status`
```

| `native` | A unit is running | No unit is running | Status |
|---|---|---|---|
| `None` or `'auto'` | **kept as it is**, whatever its mode (another agent's `native-session` is never switched off by a plain `lgs on`) | started with the **resolved** mode (below) | live |
| `'on'` / `True` | restarted if it runs otherwise | native requested | live |
| `'off'` / `False` | restarted if it runs otherwise | CSS only | live |

**Resolving `auto`** (only when no unit is running), first match wins:

1. `/tmp/lgs/flags.json` key `native` (`"on"` / `"off"`; RAM, a session override);
2. `device/defaults.json` key `native` (V1 sets `"on"` after the native gate, PLAN §4.3);
3. built-in: `auto` = **CSS only**.

`"auto"` found in a file means "not decided" and falls through to the next source; the built-in end of the chain is CSS only. Both files may be flat (`{"native": "on"}`) or nested (`{"flags": {"native": "on"}}`). `status.native` reports `{requested, resolved, source, enabled, reason}`, e.g. `{"requested": "auto", "resolved": "off", "source": "builtin", "reason": "native=auto: the native gate has not passed (device/defaults.json has no native: on)"}`; `status.mode` is then `"css-only (native=auto: …)"` (DM-6).

**A stall of the daemon itself** (SIGSTOP / SIGCONT, a starved CPU; its event loop did not run for > 1.5 s) is noticed (`status.stalls`, journal `daemon: our event loop stalled …`): glassd's silence during it is not taken for a hang (no restart), systemui gets its heartbeat **first** (`lgs_sg.js` rebuilds its last spec), and evaluations that timed out across the stall keep their sockets (REQ P7->P8, SG-6; selftest `freeze`).

**Theme off without `lgs off`** (2026-10-07 session 2; `lgs off` itself stops the unit first). Lab `--stock` steps and P1's selftests turn the Steam theme off and on with `lgs.op` alone. After 3 polls (≈ 3 s) with the theme off the unit goes **dormant** instead of exiting: the native layer, **glassd** (stopped within 1 s, `glassd.json` / `glassd-out.json` removed; not counted as a crash), the reporter, the scene graph (also the CSS-only transform overrides) and `html.lgs-native` are taken away; SteamVR page theming, page scripts and the `lgsAction` binding stay. When the theme is back it resumes in the same process within 1 s: reporter re-injected, bridge values re-sent, glassd started again (native in about 3 s), glass materializes again. It exits (full teardown, SteamVR pages stripped) when:

- the theme stays off for the grace, `shellThemeGraceS` (flag, 0..3600 s, default **600**; `0` = exit after 3 polls as in Phase 1);
- the theme is off on a **new** SharedJSContext target (Steam or its UI restarted): at once, so nothing outlives a Steam restart, **also with `--stay`**;
- Steam's devtools stay unreachable for 120 s, **also with `--stay`**.

While dormant, `status.mode` and the bridge `daemon.mode` are `"dormant"` (`daemon.native` false); `status.dormant` is `{since, graceS, stay}`, else `null`.

**`--stay`** (lab tests and P10's `native-session` only) is bounded by `STAY_MAX_S` = **2400 s** (the PC side of `native-session` gives up after 2400 s, so an older `--stay` unit has lost its client, e.g. to a usage-limit cut-off): its dormancy grace is 2400 s whatever `shellThemeGraceS` says, and 2400 s after it started the native layer ends (`css-only (--stay limit (2400 s) reached)`) and the normal rules apply from then on. A later explicit `start(native='on')` restarts such a unit.

**`start()` is serialized** by `/tmp/lgs/shell-start.lock` (RAM; 60 s wait). When another start won a race anyway, systemd's "already loaded" answer is reported as `running (…, started concurrently)`, not as a failure.

CLI: `lgs_shell.py start [--native|--css|--auto] [--stay] [--glassd PATH|none] [--glassd-args "…"] [--feed] [--test-report PATH]`, `stop`, `status`, `selftest NAME` (§9). From the PC: `python glass.py shell …` (P10 passes arguments on).

---

## 2. Flags the daemon reads

Merged as `defaults.json` < `/tmp/lgs/flags.json` (re-read within 1 s of a change; both flat or under `"flags"`):

| Flag | Default | Effect in the daemon | Status |
|---|---|---|---|
| `native` | `auto` | §1, read once at unit start | live |
| `interactivePops` | false | Scene-graph spec `profile: "wearer"` (else `"default"`), reporter option `profile`, bridge `daemon.profile` (PLAN §1.7, S2) | live |
| `actionsDryRun` | false | Every action of kind `nav` or `launch` is validated, logged and answered `{ok: true, dry: true}` without running (tests). P1's action logger has the same effect | live |
| `sgDepthAnim` | true | `false` sends the spec `depthMotion: "none"` (P7's kill switch) | live |
| `shellThemeGraceS` | 600 | Seconds the unit stays dormant while the Steam theme is off without `lgs off` (§1); `0` = exit after 3 polls | live |
| `wp.<id>` and any other name | — | Gates a SteamVR page script that declares it (§6) or an action that declares it (§5) | live |

The daemon never writes either file. `lgs off` (P1) clears `/tmp/lgs/flags.json`.

---

## 3. Daemon → Steam: values on `__LGS_RT.bridge` (P1's runtime)

The daemon calls, in SharedJSContext, `__LGS_RT.bridge.set(name, value)` for the names below. It needs `bridge.set(name, value)` (fires listeners on **every** call, also with an equal value) and `bridge.get(name)`. When `__LGS_RT` is absent nothing is sent; when the runtime (re)appears, `get(name)` returning `undefined` makes the daemon send every current value again within 1 s.

| Name | Value | When | Status |
|---|---|---|---|
| `daemon` | `{v: 1, at, ttlMs: 6000, pid, mode, native: bool, profile: 'default'\|'wearer', steamvr: bool (8090 session up), actions: [types], dryRun: bool}` | every 2 s (heartbeat); treat as gone when `Date.now() - at > ttlMs` | live |
| `geom` | §4.1 | on change (polled 1/s) | live |
| `page` | §4.2 | on change (polled 1/s) | live |
| `acks` | `{pops: {overlayKey: [ids]}, plates: {overlayKey: [ids]}}` (informational; the reporter's `ack()` is what tags elements) | on change | live |
| `reply` | `{id, ok: true, result, dry?}` or `{id, ok: false, error, detail?}` | one call per action reply (§5) | live |

Areas read these with `rt.bridge.get(name)` / `rt.bridge.on(name, fn)` (P1's API). Nothing here is written to the DOM by the daemon.

## 4. Geometry and page (systemui, read-only, also in CSS-only mode)

Read in `vr:systemui` once a second while SteamVR's devtools (8090) is up, with the SP §1.2 snippet, `FrameStore` and `OverlayStore.DumpLaserOverlays()`. The dump (a ~100 ms compositor round trip) runs 1, 3 and 6 s after the frame menu's scene-graph node (key, uv, metres per pixel, visibility, scale) or another value changed (the dump lags the node), and every 15 s as a safety net; `status.geomDumpAt` is the time of the last one. Values are rounded (lengths 0.1 mm, ratios 1e-4) so jitter does not count as a change.

### 4.1 `geom`

```json
{"v": 1, "at": 1791360000000, "S": 0.369, "H0": 1.5, "r": 1.0, "Hm": 0.5535, "unitM": 0.369,
 "mmPerCssPx": 0.7687, "dashDist": 1.15,
 "frameMenu": {"key": "valve.steam.gamepadui.frame.menu.76640005", "fWidth": 0.124, "fHeight": 1.1275,
               "mpp": 0.0015308, "uv": [0.82, 0.19, 1, 0.81], "clipTexH": 736.5, "clipCssH": 491.0, "mpMm": 0.847,
               "visible": true}}
```

- `S` = `DashboardStore.dashboardScale`; `H0` = the frame's `mainPanelHeightOverride` (1.5); `r` = `latestMeasuredPanelLocalHeight / H0`; `Hm` = `latestMeasuredPanelWorldHeight` (metres); `unitM` = S × r (metres per scene unit, also sent to glassd); `mmPerCssPx` = 1500 × Hm / 1080; `dashDist` = `DashboardStore.dashboardDistance`. The SP §1.2 snippet (DM-3), except that the page is **Steam's page found by its summon key** `valve.steam.gamepadui.main` in `frame.pages` (page ids are handed out at run time: page 3 once, page 4 on 2026-10-07; the frame's active page is SteamVR Settings or the binding UI while those show), as `lgs_sg.js` does (sg.md §4.2; REQ P7->P8, 09:25).
- `frameMenu` (WN §3.3.2): the frame-menu panel's laser target from `DumpLaserOverlays` (`fWidth`, `fHeight` in scene units), its `PooledPopup-<key>` panel's `meters-per-pixel` (`mpp`) and displayed `uv`; `clipTexH = fHeight / mpp` (texture px), `clipCssH = clipTexH / 1.5`; `mpMm = 1000 × fHeight × S / clipCssH` (mm per popup CSS px if the popup does **not** follow the user resize; × r if it does: AT-7 decides). `null` while there is no frame menu.

### 4.2 `page` (CC15)

```json
{"v": 1, "at": 1791360000000, "frameID": 7400001, "activePageID": 3, "summonKey": "valve.steam.gamepadui.main",
 "steam": true, "pages": {"1": "system.settings", "2": "system.vrwebhelper.controllerbinding", "3": "valve.steam.gamepadui.main"}}
```

`steam` is true when the Steam frame's active page shows `valve.steam.gamepadui.main`. `null` values while systemui is unreachable.

---

## 5. Actions: Steam → daemon → plugins

**Call** (any code in SharedJSContext; P1's runtime wraps it as `rt.action(type, args)`):

```js
window.lgsAction(JSON.stringify({id: 'c5b-17', type: 'vrbind', args: {app: 'steam.app.620980'}, src: 'main'}))
```

`lgsAction` is a CDP binding (`Runtime.addBinding`) the daemon adds whenever it is connected to Steam, in CSS-only and native mode (`lgsLayers`, the reporter's binding, only in native mode). It returns nothing; the answer arrives as `bridge` `reply` with the same `id`. Without a daemon the function is absent: teardown deletes both binding globals (`Runtime.removeBinding` alone leaves the function in the page), and a CSS-only unit deletes a leftover `lgsLayers`; only native-code functions are deleted, a test's own JS stand-in is left alone. Callers time out after 2 s and show nothing new (GP §4.12 "no daemon session").

**Validation, in order** (every rejection is logged with the reason, kept in `status.actions.rejected`, and answered when an `id` could be read):

| Check | Error |
|---|---|
| Payload ≤ 4096 bytes, a JSON object | `too-big`, `bad-json` |
| `id`: string ≤ 64 chars `[A-Za-z0-9_.:-]` | `bad-id` (no reply possible) |
| `type` registered by a loaded plugin | `unknown-type` |
| The call came from SharedJSContext's default execution context, and `src` (string) names a Steam window kind listed in the action's `sources` (default `["main"]`) | `bad-source` |
| `args` matches the action's schema exactly (no unknown keys, required keys present, types, ranges, regexes) | `bad-args` |
| The action's `flag`, if any, is on | `flag-off` |
| Rate: ≥ `rate` s (default 1.0) since the last accepted call of this type; ≤ 20 calls in any 10 s overall; one call of a type in flight at a time | `rate`, `busy` |
| `actionsDryRun` on and kind `nav` / `launch` | answered `{ok: true, dry: true}`, not run |
| The plugin raised or exceeded `timeout` (default 10 s) | `plugin-error`, `timeout` |

Window kinds for `src`: `main`, `bar`, `barpopup`, `frame.menu`, `floatingfooter`, `keyboard`, `notifications`, `tooltip`, `volumelevel`, `ccpopup`.

**Plugins** (`device/shell_ext/<name>.py`, owned by the package that writes them; loaded at daemon start and re-loaded when a file changes; a plugin that fails to import is listed in `status.actions.failed` and the others keep working). Lab only: `/tmp/lgs/shell-ext-test/<name>.py` (RAM) is scanned too, as plugin `test:<name>`, and may only declare kinds `echo` and `read` (anything else refuses the whole file); selftest `dm4` uses it.

```python
ACTIONS = {
    "vrbind": {
        "args": {"app": {"type": "str", "re": r"^steam\.app\.\d{1,10}$"}},  # str|int|num|bool|enum; "optional": True
        "sources": ["main"],      # default ["main"]
        "rate": 1.0,              # seconds between accepted calls, default 1.0
        "kind": "nav",            # echo | read | nav | launch (launch: never run under actionsDryRun)
        "flag": "vrBindings",     # optional: refused while the flag is off
        "timeout": 10,            # seconds, default 10
    },
}

async def run(ctx, type, args):   # -> JSON-serialisable result (becomes reply.result)
    ...
async def tick(ctx): ...          # optional, called once a second (e.g. watch a return path)
async def stop(ctx): ...          # optional, called on daemon teardown; undo everything here
```

Arg schema keys: `type` (`str`: `max` length default 256, `re`; `int`/`num`: `min`, `max`; `bool`; `enum`: `values`), `optional`.

`ctx` (one per plugin, kept for the daemon's life):

| Member | What |
|---|---|
| `await ctx.steam_eval(expr, timeout=10)` | Evaluate in SharedJSContext (by value) |
| `await ctx.vr_eval(page, expr, timeout=10)` | Evaluate in the SteamVR page whose title is `page` (`systemui`, `controllerbindingui`, …); raises if absent |
| `ctx.vr_pages()` | Titles of the live SteamVR pages |
| `ctx.flags` | The merged flags (§2), read-only |
| `ctx.dry` | True under `actionsDryRun` |
| `ctx.state` | A dict the plugin may keep things in |
| `ctx.log(msg)` | Journal + `/tmp/lgs/lgs.log` with the plugin's name |
| `ctx.geom`, `ctx.page` | The latest §4 values |

**Built-in actions:**

| Type | Kind | Args | Sources | Rate | Does |
|---|---|---|---|---|---|
| `echo` | echo | `text` (str ≤ 200, optional) | every kind | 0.2 s | returns `{echo, src, at}`: a round-trip check |
| `echo.main` | echo | as `echo` | `main` | 0.2 s | the same, main only (DM-4's wrong-source probe) |
| `sgwindow` | ui | `dim` (0..1), `recede` (0..0.3 units), `motion` (token), `ttlMs` (500..60000, default 10000), `reset` (bool); all optional | `main`, `bar`, `barpopup`, `ccpopup` | 0.25 s | Requests Steam's window dim / recede (contracts/sg.md §5) **for `ttlMs`**; refresh it while you need it, or send `reset`. Works in CSS-only mode (the daemon then installs `lgs_sg.js` in systemui for as long as the request lives). A report's own `window` field wins in native mode. Returns `{window}` |

**Kinds:** `echo`, `read` and `ui` always run; `nav` and `launch` are answered `{ok: true, dry: true}` and not run while `actionsDryRun` is on **or** P1's action logger is on (`rt.test.actions.enabled()`; the call is recorded there as `{fn: 'daemon.<type>', arg: args}`), and also when the logger state cannot be read.

## 5.1 SteamVR page theming: fonts

`lgs_vr_core.js` themes every SteamVR page (`systemui`, `controllerbindingui`, `keyboard`, …) with `theme/*.nowrap.css` + `theme/vr/*.css`. The pages' CSP (`default-src 'self' 'unsafe-eval'`, no `font-src`) blocks `data:` fonts, so every `@font-face` whose `src` is `url(data:font/woff2;base64,…)` is taken out of the page's CSS and added as a binary `FontFace` (family, `weight`, `style`, `stretch`, `unicodeRange`, `display` from the rule), once per theme version; `disable()` (theme off, daemon stop) deletes them again. `__LGS_VR.status()` lists `fonts` (`"<family> <weight> <status>"`) and `fontErrors`. Status: **live** (REQ P4->P8, FD-2).

## 6. SteamVR page scripts

Files `device/vr/<page>.<name>.js` (owners per PLAN §2.6, e.g. C5b `systemui.nowplaying.js`, C6b `systemui.settings.js`), plus test-only files in `/tmp/lgs/vr-scripts/` (RAM). `<page>` is the SteamVR page title (`systemui`, `controllerbindingui`, …).

- The file is **one JS function expression**: `(function (ctx) { …; return { remove() {…}, status() {…} }; })`. `ctx = {name, page, version, flags}`. Whatever it adds to the page, `remove()` must take away.
- An optional header line `// @lgs-flag <name>` (anywhere in the first 5 lines) injects it only while that flag is on (context packages use their `wp.<id>`).
- Injected after the page's theme CSS, into every page whose title matches, while the theme is on and the page theming is not paused (`/tmp/lgs/vr-theme-paused`, lab `--theme off vr:…`). Re-injected when the file changes or the page reloads; `remove()` of the old copy is called first.
- The daemon keeps the returned object as `window.__LGS_VRX[name] = {version, api, at}` and deletes `window.__LGS_VRX` when the last one is removed.
- Removed (`remove()`, then deleted) on daemon stop, on pause, when its flag goes off and when its file disappears. A script that throws is listed in `status.vrScripts` with the error and not retried until its file changes.
- Status per page and name: `installed`, `ok`, `flag-off`, `error: …`, `removed`.

## 7. `glassd.json` v3 (P8 writes; P9's `contracts/glassd.md` defines the meaning)

P8 copies from the reporter's report (P6) into `glassd.json`, after type checks, exactly these fields, and only once `glassd-out.json` `caps` lists their cap:

| Level | Fields copied | Cap |
|---|---|---|
| top | `dial` (from the dial file), `reduceMotion` (Steam's `prefers-reduced-motion`, polled 1/s), `unitM` (§4.1, live S × r), `masks` (report top-level `masks`), `roomDim` (report top-level `roomDim`, 0..0.9) | `unitM`, `masks`, `roomDim` |
| surface | `name`, `overlayKey`, `texW`, `texH`, `radius`, `material`, `visible`, `shapes`, `quad`, `phase`, `appear`, `phaseMs`, `plates`, `coverDz`, `masks`, `scaleFrom` | `plates`, `coverDz`, `masks`, `scaleFrom` |
| slab (report `layers[]`) | `id`, `x`, `y`, `w`, `h`, `r`, `material`, `dz`, `phase`, `appear`, `phaseMs`, `tint`, `hole` (`shadow`, `y`, `blur`, `fill`, `clip`; with cap `holeEdges` also `edges`: `{top, right, bottom, left}`, each a colour or a list of ≤ 8 colours; unparsable colours and empty edges dropped), `ox`, `oy`, `fill` (material `dim` only) | `tint`, `holes`, `holeEdges`, `offset`, `none` (material `none`), `dimSlab` (material `dim`) |
| plate | `id`, `x`, `y`, `w`, `h`, `r`, `material`, `phase`, `appear`, `phaseMs`, `tint`, `fill`, `occluder`, `shadow` | `plates`, `dim` (material `dim`) |

A slab or plate whose material needs a cap glassd does not list is **left out** (never sent as glass): `none` and `dim` slabs, `dim` plates. Without the `plates` cap, plates become cover shapes (≤ 8) as before.

**Type checks:** every number is checked (finite and in range, e.g. `texW` 0..16384, `dz` −1..1 m), and so is every list and object shape; an item (slab, plate, shape, surface) with a bad field is dropped and the rest goes on. A malformed report or glassd output never stops the daemon.

**Materialize policy** (GM §5.4), applied by P8 unless the report already sets `appear` or `phase` on that item:

- a **new slab or plate id** gets `"appear": "materialize"`;
- a slab or plate that **leaves** the report stays in `glassd.json` with `phase: 0` for its out-ramp (slab 350 ms, `thick` and `dim` slabs 514 ms, plates by material as P9 §1.3, 180 ms under `reduceMotion`), then is removed; during that time the scene-graph spec lists the slab under the surface's `slabsOut` (P7 may draw the slab panel alone; an older `lgs_sg.js` ignores it);
- **covers are never animated by P8** (GM §5.4 caution); a report's own surface `phase` is passed through.

When the report's `hole` is `true` or has no `clip` and P8 trims a sliver (`clip` in the spec), P8 sets `hole.clip` to that rect.

## 8. Acknowledgements and `lgs-native`

- **Pops** (unchanged): an element is acked when its crop and slab were pushed ≥ 350 ms ago.
- **Plates:** a plate id is acked when (a) its surface's cover node was pushed ≥ 350 ms ago, (b) `glassd-out.json` lists the id in that surface's `plates`, and (c) its materialize ramp has had time to finish (first written + ramp + 350 ms).
- The call is `__LGS_LAYERS.ack(map)` in P6's v3 form `{overlayKey: {cover: bool, pops: [ids], plates: [ids]}}` when the reporter's `status().v >= 3`, else Phase 1's `{overlayKey: [pop ids]}` (contracts/reporter.md §7). P6 tags acked plates (`data-lgs-plate-ack`; `05-native.css` then drops their CSS plate).
- **`html.lgs-native`** goes on a window when its cover is shown (glassd `cover` > 0) **or** at least one of its plates is acked (a windowless route has `cover: 0`). It comes off as before (3 s TTL in the page, at once when systemui or glassd drop out).

## 8.1 Reporter injection (native mode)

- Configuration: `theme/layers/*.json` in name order (skipping `_wip/` and `_*.json`), passed as `layers: [{file, …fragment}]`; without any fragment, Phase 1's `theme/layers.json` object (contracts/reporter.md §3.1).
- Options: `{binding: "lgsLayers", layers, version, ackMode: true, profile, geom: {S, r}}` (`profile` from `interactivePops`, `geom` from §4.1 when known).
- Re-injected when `lgs_layers.js`, any fragment or the profile changes (checked every 3 s), or when the reporter stopped or vanished.

## 9. Scene-graph spec additions (P7's `lgs_sg.js` reads them; unknown fields are ignored by older copies)

| Field | Where | Meaning | Status |
|---|---|---|---|
| `profile` | top | `"default"` \| `"wearer"` from `interactivePops` (§2) | live |
| `reduceMotion` | top | Steam's `prefers-reduced-motion` | live |
| `depthMotion` | top | `"depth"`, or `"none"` while `sgDepthAnim` is false | live |
| `unitM` | top | §4.1 | live |
| `window` | top | `{dim, recede, motion}`: the report's `window` (native), else a live `sgwindow` request | live |
| `slabsOut` | surface | `[{id, x, y, w, h, dz, slab, until}]`: slabs fading out (§7), no crop | live |
| `coverDz` | surface | from the report's surface `coverDz` when given, else 0.001 | live |
| `dim` | surface | the report's surface `dim` (0..1) | live |
| `mosaic` | surface | the report's `mosaic` bands `[{x, y, w, h}]` (≤ 16) | live |
| `popped[].interactive` | pop | `true` only when the layer says so **and** the profile is `wearer` | live |
| `popped[].from`, `motion`, `sink` | pop | copied from the report's layer | live |
| `dimSlabs` | surface | `[{id, x, y, w, h, dz, slab}]`: `material: "dim"` layers (glassd §1.4 room-dim cells). They are **not popped** (no element to crop); P7 places the cell (behind the window, scaled up) when it supports room dim | built |

**Transform overrides** (contracts/sg.md §4): the daemon merges `theme/sg/*.json` in name order (`supersedes` drops earlier ids; a rule with a `flag` is kept only while that flag is true in the merged flags) and calls `__LGS_SG.overrides({seq, rules})` whenever the active set changes and after every (re)inject. **In CSS-only mode** `lgs_sg.js` is installed in `vr:systemui` (with the 1 s heartbeat) while any override is active or a `window` state is requested, and `destroy()`ed when neither is; `destroy()` also runs at teardown in both modes.

**Depth channel:** when `device/shared/motion.js` (P5) exists, the daemon evaluates it in the same scope just before `lgs_sg.js`: `(() => { <motion.js>; return (<lgs_sg.js>)(opts); })()`, with `opts.motion = true`. Whatever `motion.js` defines at its top level (or on `globalThis`) is therefore visible to `lgs_sg.js`. A change to either file re-injects `lgs_sg.js` (`sgVersion` hashes both).

## 10. Status (`/dev/shm/lgs/shell.json`, every 2 s; `lgs_shell.py status`)

Phase 1 fields stay. `mode` is `native`, `starting`, `css-only (<reason>)` or `dormant` (§1). New: `dormant` (§1), `stalls` (`{count, lastS, agoS}`, §1), `geomDumpAt` (§4), `steam.restarted`, `steam.slowEvals` (Steam evaluations that timed out with the connection kept), `native.{requested, resolved, source}`, `flags` (merged), `bridge` (`runtime` present, last `sent` names and times), `geom`, `page`, `actions` (`types`, `plugins`, `failed`, `calls`, `rejected` (last 10), `dryRun`), `vrScripts` (`{page: {name: state}}`), `glassd.caps`, `steam.plateAcks`.

## 11. Test hooks (lab only)

| Hook | Use |
|---|---|
| `start --assume-caps plates,holes,…` | The writer acts as if glassd's `caps` listed these (checks the glassd.json side against an older binary) |
| `start --test-report PATH` | The daemon does not inject the reporter; it reads the report JSON from `PATH` (re-read on change). With `--stay` and fakeglassd it exercises the whole glassd / scene-graph path without P6 (DM-1, DM-2) |
| `/tmp/lgs/vr-scripts/<page>.<name>.js` | Test page scripts (DM-5) |
| `/tmp/lgs/shell-ext-test/<name>.py` | Test action plugins, kinds `echo` / `read` only (DM-4) |
| `lgs_shell.py selftest NAME` | `dm1` (native, fakeglassd: freeze, teardown order and no binding global left, restart backoff), `dm2 [--keep-dump]` (native, fakeglassd: v3 fields incl. `roomDim`, a `dim` slab and the keyboard surface, fades), `dm3` (geometry against the SP §1.2 snippet; the frame menu against our own dump, atomic: the daemon's dump came after ours and the panel did not change; holds `lab-vr.lock`), `dm4` (echo / unknown type / wrong source / rate through the binding, and a plugin file loaded live from the RAM test folder; holds `lab.lock`), `dm5 [--stop]` (a test page script injected, listed, removed; `--stop` also stops and restarts the daemon and checks that no binding global is left; holds `lab-vr.lock`, with `--stop` also `native.lock` and `lab.lock`), `dm6 [--live]` (resolve `auto`; `--live` restarts under `native.lock`, `lab.lock`, `lab-vr.lock`), `grace [--native]` (theme off / on without `lgs off`: dormant with mode `dormant`, then resumed in the same process; `--native` with a native unit and fakeglassd: glassd stopped while dormant, not counted as a crash, a new glassd after; holds `lab.lock`, `lab-vr.lock`, with `--native` also `native.lock`), `plates` (P6's v3 reporter with fakeglassd: a live element's plate reaches glassd, is acked, fades; holds `native.lock`, `lab.lock`, `lab-vr.lock`), `freeze` (the real glassd with `--no-feed`, no camera: SIGSTOP the daemon 15 s, then glassd is not restarted, the heartbeat goes first, nodes back ≤ 1 s, `lgs-native` ≤ 1.5 s; holds `native.lock`, `lab-vr.lock`), `actions` (validator unit tests, offline). `dm1`, `dm2` hold `native.lock` and `lab-vr.lock`. Every native test ends with "back to CSS only" and checks that no reporter, `__LGS_MOTION`, scene graph, `glassd.json` or `lgsLayers` global is left |

## 12. Changes

- 2026-10-07 04:10: first version (M1).
- 2026-10-07 08:10-09:30 (review R1): §1 glassd stopped while dormant, `mode` `dormant`, `--stay` bounded (2400 s) and ended by a Steam restart or loss, `start()` serialized, `python3 -B`; §5 `lgsLayers` only in native mode, both binding globals deleted at teardown, RAM test plugins; §4 frame-menu dumps after a change (+ 15 s safety net), `geomDumpAt`; §7 `hole.edges` (REQ P9->P8), type checks; §10 `mode` values; §11 tests. 09:25: §4.1 Steam's page by summon key, §1 own stalls (REQ P7->P8 ×2), selftest `freeze`. All backward compatible.
- 2026-10-07 06:15-07:00: §1 theme off without `lgs off` → dormant (grace flag `shellThemeGraceS`, default 600 s), exit on a Steam restart or 120 s without Steam; §5.1 binary fonts in SteamVR pages (REQ P4->P8); §7 `roomDim`, `dim` slabs and `dim` plates behind their caps; §9 `dimSlabs`; §10 `dormant`, `steam.restarted`, `steam.slowEvals`; §11 `grace`, `plates` selftests. A Steam evaluation that times out no longer drops the connection (two in a row are tolerated). All backward compatible.
