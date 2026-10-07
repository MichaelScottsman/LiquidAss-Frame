# Contract: runtime core and lifecycle (P1)

Owner: **P1**. Files: `device/lgs.py`, `device/lgs_core.js`, `device/lgs_index.js`, `device/lgs`, `device/glass-shell.desktop`, `device/icon.png`, `device/rt/00-rt.js`. Sources: PLAN §2.3 P1, §1.17, §2.1 (flags, sync safety); SR §3.9, §7; IM §8; LAB.md; NATIVE.md "Runtime".

**Status:** see "Status" in `docs/phase2/wp/P1.md`. Everything below is live from M1 unless marked *(planned)*. This file only grows; a behaviour change is listed in §11 with its date.

Everything runs in Steam's **SharedJSContext** (devtools 127.0.0.1:8080), in memory only. Nothing is written to disk or to web storage. `lgs off`, a Steam restart or a reboot gives the stock UI.

---

## 1. Writing a runtime module

One file per module, `device/rt/NN-name.js`, where `NN` is your theme number (PLAN §2.6). The file only calls `define` at load time:

```js
// device/rt/41-home.js (C2a)
__LGS_RT.define({
  name: 'home',                 // unique; other modules list it in deps
  deps: ['react', 'attention'], // installed first; if one is missing, off or failed, this module is not installed
  flag: 'wp.c2a',               // optional: installed only while this flag is on
  install(rt) {                 // may be async (≤ 5 s); its return value is your API: rt.use('home')
    const off = rt.windows.track((w) => {          // every current and future Steam popup window
      if (w.kind !== 'main') return;
      w.html.classList.add('lgs-home');
      return () => w.html.classList.remove('lgs-home');   // on window close, removal, or teardown
    });
    rt.listen(someWindow, 'pointermove', onMove, { passive: true }); // undone automatically
    return { open() { /* … */ } };
  },
  remove() {                    // may be async (≤ 3 s); undo what install did that rt.* did not track
    return { patchedLeft: 0 };  // optional report; P2 reports unrestored fiber patches here
  },
});
```

**Rules.**

1. **Load time does nothing.** Top-level code only calls `__LGS_RT.define(...)` (constants and function declarations are fine). No DOM writes, timers, listeners or Steam calls outside `install`. The loader wraps each file in its own function, so top-level `const`/`function` names stay private to the file.
2. **Fail closed.** If `install` throws (or times out), the module is marked `failed`, its `remove()` is called, and every subscription it made through `rt` is undone. The CSS theme and every other module keep working. `remove()` must therefore be safe after a partial install.
3. **Clean removal.** After `remove()` nothing of yours may remain: no `lgs-*` class, no `data-lgs-*` attribute, no node, listener, timer, patched function or global (RT-4, G-REMOVE). Prefer the scoped helpers in §3: everything made through them is undone for you, in reverse order, even if `remove()` forgets.
4. **Globals.** Avoid them; return an API from `install` instead (`rt.use(name)`). A new global whose name starts with `lgs`/`__LGS` that your file or install creates is deleted by the runtime on teardown.
5. **Names.** Module names are short and unique (`react`, `input`, `attention`, `home`, `more`). Two files defining the same name: the second is marked failed (`lgs check` reports it offline).
6. **No web storage, no disk, no network.** Never `localStorage`, `sessionStorage`, IndexedDB or cookies.
7. **Work in progress** goes in `device/rt/_wip/`: the loader and `lgs check` skip `_wip/` folders and every file or folder whose name starts with `_` or `.`.

**Load order.** `00-rt.js` (the core) first, then `device/shared/*.js`, then `device/rt/*.js` in name order. Install order is dependency order (ties keep name order). Removal is the exact reverse of install order.

**Shared files** (`device/shared/*.js`, e.g. P5's `motion.js`) are plain scripts that may also run outside Steam (P8 prepends `motion.js` to `lgs_sg.js`). The loader evaluates them with `module` and `exports` in scope; whatever they put on `module.exports` (or, failing that, the one `__LGS*` global they define) is `rt.shared.<basename>`, e.g. `rt.shared.motion`. A standalone-safe pattern:

```js
(function (root) {
  const api = { sample, settle };
  if (typeof module === 'object' && module && module.exports) module.exports = api;
  else root.__LGS_MOTION = api;
})(this);
```

---

## 2. Module states (`lgs status`, `rt.status()`)

| State | Meaning |
|---|---|
| `defined` | Loaded, not processed yet (only before `start()`) |
| `installing` | `install` running |
| `installed` | Live |
| `off` | Its `flag` is off. It installs by itself when the flag turns on, and is removed when it turns off |
| `blocked` | A dependency is missing, off or failed (`reason` says which) |
| `failed` | Its file failed to load or parse, `install` threw or timed out, or its name is a duplicate (`error` says why). Stays failed until the next `lgs on` |
| `removing` / `removed` | During and after teardown |

---

## 3. `rt`: the object `install(rt)` receives

`rt` is your module's scoped view of `window.__LGS_RT`. Members marked **(tracked)** are undone automatically when your module is removed.

### 3.1 Registry

| Member | Does |
|---|---|
| `rt.name` | Your module's name |
| `rt.use(name)` | The API another module's `install` returned. Throws if that module is not installed. List it in `deps` |
| `rt.has(name)` | `true` if that module is installed (for optional integrations, without `deps`) |
| `rt.module(name)` | `{name, state, reason, error}` or `null` |
| `rt.shared` | `{motion: …}` from `device/shared/*.js` |
| `rt.data(name)`, `rt.data.<name>` | JSON fragments the loader passes in. `rt.data('popups')`: every `theme/popups/*.json` in name order (`_wip` skipped), each object with `"file": "<name>.json"` added (P6's popup wrapper). `rt.data(name)` returns a copy. A file with invalid JSON is left out and listed in `failedLoads` |
| `rt.log(msg, data)`, `rt.warn(…)`, `rt.error(…)` | Into the runtime's log ring (300 entries, `rt.status({log: 40})`), tagged with your module name |
| `rt.sel('%{Token} .x')` | Resolves `%{Token}` classes with the theme's class index (same syntax as theme CSS). Throws on an unresolved token |
| `rt.W` | SharedJSContext's `window` |
| `rt.version` | Runtime core version (1) |

### 3.2 Lifecycle helpers (tracked)

| Member | Does |
|---|---|
| `rt.cleanup(fn)` | Runs `fn` on removal. Returns `off()` that runs it now |
| `rt.listen(target, type, fn, opts)` | `addEventListener`, removed on removal. Returns `off()` |
| `rt.setTimeout(fn, ms)`, `rt.setInterval(fn, ms)` | Cleared on removal. Return `off()` |
| `rt.on(event, fn)` | Runtime events: `'flags'` (changed names, values), `'module'` (name, state), `'teardown'` (reason), `'test:input'` (mode), `'test:actions'` (on) |

### 3.3 Windows: `rt.windows` (tracked)

One popup-created and one popup-destroyed callback on `g_PopupManager` serve every module (so subscriber counts stay +1 however many modules there are). A new popup is reported once its `document.body` exists (polled every 50 ms, ≤ 5 s). A 2 s reconcile also catches any window a callback missed.

An **entry** is `{win, doc, html, key, kind, name, popup}`:

- `key`: the SteamVR overlay key, e.g. `valve.steam.gamepadui.barpopup.70880001`;
- `kind`: the key without the `valve.steam.gamepadui.` prefix and numeric suffixes: `main`, `bar`, `barpopup`, `frame.menu`, `floatingfooter`, `tooltip`, `volumelevel`, `keyboard`, `notifications`, … (the LAB.md surface names);
- `name`: Steam's popup name (`VR_uid0`, …); `popup`: Steam's popup object.

| Member | Does |
|---|---|
| `rt.windows.track(fn)` | `fn(entry)` for every current and future window; `fn` may return a cleanup, called when that window closes or the subscription ends. Returns `off()`. **The usual way to put classes or listeners on every window** |
| `rt.windows.onAdd(fn)`, `rt.windows.onRemove(fn)` | Future windows only. Return `off()` |
| `rt.windows.each(fn)` | Current windows, once |
| `rt.windows.list()`, `.main()`, `.byKind(kind)`, `.find(win)` | Lookups |

### 3.4 Flags: `rt.flags`

| Member | Does |
|---|---|
| `rt.flags.get(name)` | Effective value (`undefined` if nobody set it) |
| `rt.flags.enabled(name)` | Truthiness: `false`, `0`, `''`, `null`, `'off'`, `'false'`, `'no'`, `'0'`, `'none'` are off |
| `rt.flags.all()`, `rt.flags.sources()` | Every effective value, and the layer each comes from |
| `rt.flags.on(name, fn)` (tracked) | `fn(value, previous, name)` when that flag changes |
| `rt.flags.onAny(fn)` (tracked) | `fn(changedNames, allValues)` |

A module with `flag` needs no code for its own gate: the runtime installs and removes it as the flag changes.

### 3.5 Daemon bridge: `rt.bridge` (P8 → page)

| Member | Does |
|---|---|
| `rt.bridge.set(key, value)` | Stores a JSON-able value and notifies subscribers **only if it changed**. Returns `true` when it changed. P8 calls it over CDP: `window.__LGS_RT && __LGS_RT.bridge.set('geom', {...})` |
| `rt.bridge.get(key)` | Latest value or `undefined` |
| `rt.bridge.age(key)` | ms since the last `set` (changed or not), `Infinity` if never |
| `rt.bridge.on(key, fn)` (tracked) | `fn(value, previous, key)` on change |
| `rt.bridge.keys()` | Keys set so far |

Keys in use (the publisher defines the value shape in its contract): `geom` (P8: S, r, Hm, dashboard distance, frame-menu `fHeight` and clip height), `page` (P8: `activePage`, CC15), `acks` (P8). New keys: name them in your contract. The bridge is reset by every `lgs on`; publishers re-send at least once a second while values change, so a fresh runtime catches up within 1 s.

### 3.6 Test hooks: `rt.test` (lab and acceptance tests only)

Every hook expires on its own after its TTL (default **300 s**), so a crashed lab step never leaves one on. Teardown clears them all.

| Member | Does |
|---|---|
| `rt.test.flags.push(obj, {ttlMs})` | Adds a flag overlay above every other layer; returns a token. Modules gated by those flags install or remove at once (await `rt.settled()` to wait). P10's `--flags a,b` uses this |
| `rt.test.flags.pop(token)` | Removes that overlay; `true` if it existed |
| `await rt.test.flags.with(obj, async fn, {ttlMs})` | push, wait for installs, run `fn(rt)`, pop and wait for removals, in `finally` |
| `rt.test.flags.list()` | Active overlays with their remaining TTL |
| `rt.test.input.set('pad' \| 'laser' \| null, {vrMode, ttlMs})` | Input-mode stub. Calls P3's `rt.input.stub` (contracts/interaction.md) when `input` is installed; changes only our classes, never Steam's getters. Also emits `'test:input'`. `null` clears it |
| `rt.test.input.get()` | The stubbed mode or `null` |
| `rt.test.actions.enable(on, {ttlMs})` | Action-logger switch. While on, P2's `actions.*` must call `rt.test.actions.record({fn, arg})` and **not run** (HA §14, RX-7) |
| `rt.test.actions.enabled()`, `.record(e)`, `.log()`, `.take()` | Read the switch; append; copy; copy and clear |
| `rt.test.reset()` | Everything above off |
| `rt.test.state()` | `{input, actions, actionsLogged, flags}` |

**Recommendation to P10:** turn `rt.test.actions.enable(true)` on at the start of every locked lab step and off at its exit, so no test can launch anything by accident (never-list).

### 3.7 Status

| Member | Returns |
|---|---|
| `rt.status({flags, log, counts})` | `{runtime: 'loaded'\|'running'\|'stopping'\|'removed', version, build, since, modules: [{name, file, state, flag, deps, reason, error, installMs, subscriptions}], failedLoads: [{file, error}], flagsSet (non-builtin), windows: [kinds], bridge: {key: ageMs}, test, globals, listeners}`; with `flags: true` also every flag and its source, `log: n` the last n log entries, `counts: true` Steam subscriber counts (popup-created / popup-destroyed callbacks, NavigationSource) for leak checks |
| `await rt.settled()` | Waits for pending installs/removals, then `status()` |
| `rt.counts()` | The Steam subscriber counts alone |

---

## 4. Flags

Layers, lowest first. The effective value of a flag comes from the highest layer that sets it.

| Layer | Where | Who writes it |
|---|---|---|
| `builtin` | `BUILTIN_FLAGS` in `device/lgs.py` (table below) | P1 |
| `defaults` | `device/defaults.json`: either a flat object, or `{"flags": {...}}`; keys starting with `_` or `$` are comments | V1 only |
| `session` | `/tmp/lgs/flags.json` (RAM): a flat object | `lgs flags name=value`; P10's `--flags` writes it for one step and restores it. CLI `lgs off` deletes it |
| `cli` | `lgs on --flags a,b=v` | That one `on`; the next `on`/reload drops it |
| `test` | `rt.test.flags.push` overlays | Lab steps (TTL 300 s) |

**Built-in defaults** (PLAN §1.17; "gated" flags stay off until V1 enables them in `defaults.json`):

| Flag | Default | § |
|---|---|---|
| `rt` | `true` | Runtime master switch: `false` = CSS theme only |
| `native` | `"auto"` | S1: `auto` \| `on` \| `off` |
| `interactivePops` | `false` | S2 |
| `sheetRecede` | `false` | S7 |
| `frameHeight` | `false` | S8 |
| `tabBarAlways` | `false` | S9 (gated) |
| `winbarMove` | `false` | S10 (gated) |
| `vrBindings` | `false` | S13 |
| `ccPopup` | `false` | S15 |
| `pointerProxy` | `"native"` | S16: `native` \| `on` \| `off` |
| `haptics` | `false` | S17 |
| `hudPlacement` | `false` | S21 |
| `storeOrnament` | `false` | S22 (gated) |
| `settingsDrill` | `false` | S23 (gated) |
| `wp.<id>` | unset (off) | Each package's runtime gate (PLAN §2.1) |
| `rt.stubs`, `rt.stubThrow` | `false` | P1's own test stubs (§9) |

**Python readers** (the daemon, lab): `import lgs; lgs.flags_effective()` returns builtin + defaults + session merged (no test overlays: those live in the page; read them with `__LGS_RT.flags.all()` over CDP). `lgs.flag_layers()` returns the layers separately.

**CLI.**

```
lgs flags                      # effective flags, each with its layer; plus the live runtime view
lgs flags wp.c2a=1 native=on   # session layer (/tmp/lgs/flags.json), applied live at once
lgs flags wp.c2a=              # unset one
lgs flags --reset              # delete /tmp/lgs/flags.json, applied live
lgs on --flags wp.c2a,rt.stubs # cli layer, this "on" only
```

Values: `1/true/on/yes` and `0/false/off/no` are booleans (except for string-valued flags such as `native`, which keep the text), then JSON (`2`, `"x"`), else the text.

---

## 5. Lifecycle

### `lgs on` (also the lab's `--theme on`, `lgs reload`, `lgs dial`)

One devtools session to SharedJSContext:

1. `await __LGS_RT.teardown('reload')` if a runtime is there (modules removed in reverse order).
2. The CSS core (`lgs_core.js`): one `<style>` per window, `html.lgs-on`, the class index `__LGS_INDEX`.
3. Unless `--no-rt` or the flag `rt` is off: evaluate `00-rt.js` with the flag layers; then each `device/shared/*.js` and `device/rt/*.js` file in name order, **each in its own evaluation** (a syntax error fails only that file, recorded in `failedLoads`); then `await __LGS_RT.start()`.
4. **Fallback:** if the loader itself fails, the CSS theme stays on and the result says `runtime: {runtime: 'off', reason}` (Phase 1 behaviour).
5. With `vr` (the CLI): start `lgs-shell` with `native` = `on` (`--native`), `off` (`--css`) or `auto` (neither); `reload` and `dial` pass `None` (keep a running unit as it is). P8's `lgs_shell.start(native=…)` takes the strings once it declares `NATIVE_MODES = ('auto', 'on', 'off')`; until then `auto` maps to `defaults.json`'s `native` (`on` → native, otherwise keep / CSS only).

The JSON result has `runtime: {runtime, modules: {name: state}, installed, failed: [...], flagsSet, loadMs}`.

### `lgs off`

1. `lgs-shell` stopped (native layer first).
2. `await __LGS_RT.teardown('off')`: modules removed in reverse install order; test hooks off; the popup callbacks unregistered; tracked globals deleted; `window.__LGS_RT` deleted.
3. The CSS core removed from every window.
4. A **sweep** of every popup window and SharedJSContext.
5. SteamVR pages stripped; `/tmp/lgs/flags.json` deleted (CLI only, not the lab's `--theme off`).

The result carries the cleanup report:

```json
{"enabled": false,
 "runtime": {"reason": "off", "removed": ["home", "react"], "errors": [], "reports": {"react": {"patchedLeft": 0}},
             "patchedLeft": 0, "failed": [], "globalsDeleted": [], "globalsLeft": [], "listenersLeft": 0, "ms": 12},
 "leftovers": {"clean": true, "windows": {}, "globals": ["__LGS_INDEX", "__LGS_LAB"]},
 "flagsFile": "cleared"}
```

`leftovers.windows` lists, per window, elements still carrying an `lgs-*` class, a `data-lgs-*` attribute or an `lgs-` id, and `__LGS*` globals on that window. `leftovers.globals` lists SharedJSContext globals: `__LGS_INDEX` (the class-index cache, inert data) and `__LGS_LAB` (lab helpers) are expected; `__LGS_RT` or `__LGS` there means a failure.

### Liveness watch

If `html.lgs-on` leaves the main window for **2 s** (another agent's `--theme off`, or any `__LGS.disable()`), the runtime removes every module and itself (≤ 2.25 s). `__LGS.disable()` also calls `__LGS_RT.teardown('theme off')` directly. Nothing ever re-installs on its own: only `lgs on` does.

### `lgs status`

Adds `runtime: __LGS_RT.status({counts: true})` (or `{runtime: 'off'}`) to the theme status.

---

## 6. Offline bundle check: `lgs check`

`python device/lgs.py check [--json]` runs on the PC (no device) or the Frame. P10 exposes it as `python glass.py check-theme`; Python callers use `lgs.check(root=None, node=True)` → `{ok, errors, warnings, checked, skippedWip, node}`.

| Checked | Rule |
|---|---|
| `theme/*.css`, `theme/vr/*.css` | Balanced braces, strings and comments (else the bundler skips the file); `@keyframes`, `@font-face`, `@property`, `@import` only in `*.nowrap.css`; no declaration outside a rule in a `.nowrap` file; `%{Token}` syntax |
| `theme/layers.json`, `theme/lens.json`, `theme/layers/*.json`, `theme/popups/*.json`, `theme/sg/*.json`, `device/defaults.json` | Valid JSON |
| `device/rt/*.js`, `device/shared/*.js`, `device/vr/*.js` | `node --check` syntax (when node is installed; the Frame has none, the loader still isolates a broken file); `NN-name.js` naming and a `define()` call (warnings); duplicate module names (error) |

Skipped everywhere: `_wip/` folders and names starting with `_` or `.` (listed under `skippedWip`). Exit 1 when any error. **Run it before every save into `theme/` or `device/rt/`.**

The bundler (`lgs on`) uses the same file listing: `lgs.visible_files(dir, suffix)` and `lgs.theme_css_files()`. `lgs.bundle_files(paths)` and `lgs.brace_error(text)` keep their Phase 1 behaviour.

---

## 7. Python API (`import lgs`, used by the lab and the daemon)

| Name | Does |
|---|---|
| `op(name, quiet=False, text=None, vr=False, native=None, flags=None, rt=None)` | `on` / `off` / `status` / `toast` as above. The lab calls `op('on'|'off', quiet=True)` (no `vr`): runtime included |
| `flags_effective(cli=None)`, `flag_layers(cli=None)`, `BUILTIN_FLAGS` | §4 |
| `check(root=None, node=True)` | §6 |
| `visible_files(dir, suffix)`, `theme_css_files()`, `rt_sources()` | Listings with the `_wip` rule |
| `run_js(target, expr, timeout)`, `Session`, `targets()`, `find_target()`, `overlay_key()` | Phase 1 CDP plumbing, unchanged |
| `bundle_files(paths)`, `brace_error(text)`, `log(msg)`, `THEME_DIR`, `ROOT`, `DIAL` | Unchanged |

---

## 8. Cost

- Load: one devtools evaluation per file (a few ms each) plus the modules' own `install` time.
- Idle: one 250 ms timer (a `classList.contains` on main), a MutationObserver on main's `<html>` class attribute, and a window reconcile every 2 s. No per-frame work. RT-7 measures it.

---

## 9. P1's test stubs

Defined inside `00-rt.js`, off by default:

| Module | Flag | Does |
|---|---|---|
| `rt.stub.a` | `rt.stubs` | `lgs-rt-stub` class and `data-lgs-rt-stub="<kind>"` on every window's `<html>` (RT-3); one `NavigationSource` subscription |
| `rt.stub.b` | `rt.stubs` | deps `rt.stub.a`; a bridge, a flag and a DOM listener, a 60 s interval |
| `rt.stub.c` | `rt.stubs` | deps `rt.stub.b`; async install and remove |
| `rt.stub.throw` | `rt.stubThrow` | Sets a class, then throws in `install` (RT-2): the class must be gone and every other module installed |

`lgs selftest` runs RT-1 to RT-7 with them (evidence in `docs/phase2/wp/P1.md`).

---

## 10. What other packages must provide

| Package | What |
|---|---|
| Every module | `remove()` safe after a partial install; a `{patchedLeft}` report if it patches Steam objects |
| P2 | `remove()` returns `{patchedLeft}`; `actions.*` honour `rt.test.actions.enabled()` |
| P3 | `rt.input.stub(mode, opts)` → `restore()` (contracts/interaction.md); `rt.test.input` forwards to it |
| P8 | Calls `__LGS_RT.bridge.set(key, value)` (and tolerates `__LGS_RT` being absent); reads `lgs.flags_effective()` or `/tmp/lgs/flags.json`; declares `NATIVE_MODES` once `start(native='auto'|'on'|'off')` works |
| P10 | `--flags` through `rt.test.flags.push/pop`; `check-theme` through `lgs.check()`; actions logger on in every step (recommended) |

---

## 11. Changelog

| Date | Change |
|---|---|
| 2026-10-07 | First version (M1): registry, flags, windows, bridge, test hooks, liveness, loader, `lgs check`, `lgs flags`, cleanup report |
