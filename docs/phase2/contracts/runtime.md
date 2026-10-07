# Contract: runtime core and lifecycle (P1)

Owner: **P1**. Files: `device/lgs.py`, `device/lgs_core.js`, `device/lgs_index.js`, `device/lgs`, `device/glass-shell.desktop`, `device/icon.png`, `device/rt/00-rt.js`. Sources: PLAN §2.3 P1, §1.17, §2.1 (flags, sync safety); SR §3.9, §7; IM §8; LAB.md; NATIVE.md "Runtime".

**Status:** see "Status" in `docs/phase2/wp/P1.md`. Everything below is live from M1 unless marked *(planned)*. This file only grows; a behaviour change is listed in §11 with its date.

Everything runs in Steam's **SharedJSContext** (devtools 127.0.0.1:8080), in memory only. Nothing is written to disk or to web storage. `lgs off`, a Steam restart or a reboot gives the stock UI.

---

## 1. Writing a runtime module

One file per module, `device/rt/NN-name.js`, where `NN` is your theme number (PLAN §2.6). The file only calls `define` at load time. The loader evaluates each file inside a **strict-mode** wrapper function (since R1), so an implicit global throws at load instead of leaking past `lgs off`:

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
2. **Fail closed.** If `install` throws (or times out), the module is marked `failed`, its `remove()` is called, and every subscription it made through `rt` is undone. The CSS theme and every other module keep working. `remove()` must therefore be safe after a partial install, **and safe to call twice**: an `install` that times out (5 s) keeps running, so when it finally settles the runtime calls `remove()` once more to undo what it did outside `rt`. After a module is removed or failed, its `rt` is **dead**: `rt.windows.*`, `rt.listen`, `rt.setTimeout`/`setInterval`, `rt.on`, `rt.flags.on*`, `rt.bridge.on` and `rt.expose` do nothing and return a no-op `off()`, `rt.cleanup(fn)` runs `fn` at once, and `rt.action` resolves `{ok: false, error: 'removed'}`, so a late `await` continuation can no longer leak (review R1 M2).
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
| `rt.sel('%{Token} .x')` | Resolves `%{Token}` classes with the theme's class index (same syntax as theme CSS). Throws on an unresolved token. The index is `window.__LGS_INDEX`: read it at call time, never keep a copy (it is rebuilt when Steam registers new webpack chunks) |
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

An **entry** is `{win, doc, html, key, kind, name, popup, visible()}`:

- `key`: the SteamVR overlay key, e.g. `valve.steam.gamepadui.barpopup.70880001`;
- `kind`: the key without the `valve.steam.gamepadui.` prefix and numeric suffixes: `main`, `bar`, `barpopup`, `frame.menu`, `floatingfooter`, `tooltip`, `volumelevel`, `keyboard`, `notifications`, … (the LAB.md surface names);
- `name`: Steam's popup name (`VR_uid0`, …); `popup`: Steam's popup object;
- `visible()`: `true` while the window's document is visible (`visibilityState`).

**Pooled popups.** Steam creates most popups once and then only shows and hides them: opening the "+" list shows the existing `barpopup` window, it creates none (probe 2026-10-07, RT-3). So "a popup opened" is `onShow`, not `onAdd`; `onAdd` fires for windows that are really created (new frame menus, a new desktop window). `track()` covers both: it sees every window, shown or hidden.

| Member | Does |
|---|---|
| `rt.windows.track(fn)` | `fn(entry)` for every current and future window; `fn` may return a cleanup, called when that window closes or the subscription ends. Returns `off()`. **The usual way to put classes or listeners on every window** |
| `rt.windows.onAdd(fn)`, `rt.windows.onRemove(fn)` | Future windows only (created / closed). Return `off()` |
| `rt.windows.onShow(fn)`, `rt.windows.onHide(fn)` | `fn(entry)` when a known window's document becomes visible / hidden: a pooled popup opening or closing (the "+" list, bar menus, tooltip, frame menus). Return `off()` |
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
| `rt.bridge.set(key, value)` | Stores a JSON-able value and notifies subscribers **on every call**, also with an equal value (contracts/daemon.md §3: a repeated action reply must arrive). Returns `true` when the value changed. P8 calls it over CDP: `window.__LGS_RT && __LGS_RT.bridge.set('geom', {...})` |
| `rt.bridge.get(key)` | Latest value or `undefined` |
| `rt.bridge.age(key)` | ms since the last `set` (changed or not), `Infinity` if never |
| `rt.bridge.on(key, fn)` (tracked) | `fn(value, previous, key, changed)` on every `set`; skip the call when `changed` is `false` if you only want changes |
| `rt.bridge.keys()` | Keys set so far |

Keys in use (the publisher defines the value shape in its contract, contracts/daemon.md §3): `daemon` (P8 heartbeat every 2 s), `geom` (P8: S, r, Hm, dashboard distance, frame-menu `fHeight` and clip height), `page` (P8: `activePage`, CC15), `acks` (P8), `reply` (P8: action replies, read through `rt.action`). New keys: name them in your contract. The bridge is reset by every `lgs on`; the daemon sees `get(name) === undefined` and re-sends every value within 1 s.

### 3.5a Daemon actions: `rt.action`

| Member | Does |
|---|---|
| `await rt.action(type, args, {src, timeoutMs})` | Calls the daemon (contracts/daemon.md §5): `window.lgsAction(JSON.stringify({id, type, args, src}))`, then resolves with the bridge `reply` of the same `id`: `{id, ok: true, result, dry?}` or `{id, ok: false, error, detail?}`. **Never rejects.** `src`: the Steam window kind the call is made for (default `'main'`). `id` is `<module>:<n>`. Errors added by the runtime: `no-daemon` (no `lgsAction` binding: CSS-only without a daemon), `timeout` (default 2 s without a fresh daemon heartbeat, 12 s with one), `call-failed`, `teardown` (pending calls when the runtime is removed) |

`nav` and `launch` actions are not run while the action logger is on: the daemon reads `rt.test.actions.enabled()` and records them there as `daemon.<type>` (never-list).

### 3.5b Public members: `rt.expose` (tracked)

| Member | Does |
|---|---|
| `rt.expose(name, value)` | Puts `value` on the public runtime object as `__LGS_RT[name]` (and so on every module's `rt` and for the lab), for the one-accessor APIs of PLAN §1.4 (e.g. P3's `rt.input`). Deleted when your module is removed. Throws if `name` is a core member or another module's. Returns `off()` |

`rt.status().exposed` lists `{name: module}`. A member set by plain assignment (`__LGS_RT.input = api`) also works, but is only deleted at teardown, not when your module's flag turns off: prefer `rt.expose`.

### 3.6 Test hooks: `rt.test` (lab and acceptance tests only)

Every hook expires on its own after its TTL (default **300 s**), so a crashed lab step never leaves one on. Teardown clears them all.

| Member | Does |
|---|---|
| `rt.test.flags.push(obj, {ttlMs})` | Adds a flag overlay above every other layer; returns a token. Modules gated by those flags install or remove at once (await `rt.settled()` to wait). P10's `--flags a,b` uses this |
| `rt.test.flags.pop(token)` | Removes that overlay; `true` if it existed |
| `await rt.test.flags.with(obj, async fn, {ttlMs})` | push, wait for installs, run `fn(rt)`, pop and wait for removals, in `finally` |
| `rt.test.flags.list()` | Active overlays with their remaining TTL |
| `rt.test.input.set('pad' \| 'laser' \| null, {vrMode, ttlMs})` | Input-mode stub. Calls P3's `rt.input.stub` (contracts/interaction.md) when `input` is installed; changes only our classes, never Steam's getters. A stub set while no module provides `rt.input.stub` is applied as soon as one installs, with the TTL left (R1). Returns `{mode, applied}`. Also emits `'test:input'`. `null` clears it |
| `rt.test.input.get()` | The stubbed mode or `null` |
| `rt.test.actions.enable(on, {ttlMs})` | Action-logger switch. While on, P2's `actions.*` must call `rt.test.actions.record({fn, arg})` and **not run** (HA §14, RX-7) |
| `rt.test.actions.enabled()`, `.record(e)`, `.log()`, `.take()` | Read the switch; append; copy; copy and clear |
| `rt.test.reset()` | Everything above off |
| `rt.test.state()` | `{input, actions, actionsLogged, flags}` |

**Recommendation to P10:** turn `rt.test.actions.enable(true)` on at the start of every locked lab step and off at its exit, so no test can launch anything by accident (never-list).

### 3.7 Status

| Member | Returns |
|---|---|
| `rt.status({flags, log, counts})` | `{runtime: 'loaded'\|'running'\|'stopping'\|'removed', version, build, since, modules: [{name, file, state, flag, deps, reason, error, installMs, subscriptions}], failedLoads: [{file, error}], flagsSet (non-builtin), windows: [kinds, "(hidden)" when not visible], bridge: {key: ageMs}, test, globals, exposed, actionsPending, listeners, idle: {ticks, tickMsTotal, t}}`; with `flags: true` also every flag and its source, `log: n` the last n log entries, `counts: true` Steam subscriber counts for leak checks: `popupCreated`, `popupDestroyed`, `navigationSource` (FocusNavController) and `vrNavigationType` (`vrGamepadInput.RegisterForNavigationTypeChange`, IM §8; since R1) |
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
| `rt.stubs`, `rt.stubThrow`, `rt.stubSlow` | `false` | P1's own test stubs (§9) |
| `react` | `true` | P2's kill switch for T3 (contracts/react.md §1) |
| `reactLab` | `false` | P2's lab route, tests only (react.md §9) |
| `actionsLive` | `false` | P2: Steam actions run only when `true` (react.md; V1 sets it at release) |
| `actionsDryRun` | `false` | P8: `nav`/`launch` actions logged, not run (daemon.md §2) |
| `sgDepthAnim` | `true` | P8/P7: depth motion kill switch (daemon.md §2) |
| `shellThemeGraceS` | `600` | P8: seconds the unit stays dormant while the theme is off without `lgs off` (daemon.md §2) |

A package that wants a built-in default for its own flag files a REQ to P1 (or states it in its contract; P1 copies it here).

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

0. **Readiness (since R1, review M1).** Before anything is torn down or injected, `lgs on` waits until Steam's UI is up and the class index is plausible: `SteamUIStore`, `g_PopupManager`, the main window (with a body) and a live webpack runtime (`webpackChunksteamui.push` is not `Array.prototype.push`); then `lgsIndexShared()` gives an index with at least **200** CSS modules (healthy: about 550) and at most half of the theme's distinct tokens unresolved. It retries with backoff **2, 4, 8 s, then every 15 s**, up to **120 s** (`READY_WAIT_S`; `op(..., wait=)`), reconnecting each time (a SharedJSContext that reloads is followed), and writes each attempt to `/tmp/lgs/lgs.log` (`index: attempt N: waiting …`). If it gives up, **nothing changes** (the CSS and runtime stay as they were) and the result says `index: {state: 'gave-up', missing, size, attempts, waitedS}`, `runtime: {runtime: 'unchanged'}`. If only the unresolved share is off at the end (a theme older than the Steam build), it injects anyway (Phase 1 behaviour) with `index.state: 'gave-up'`.

**The class index** (`device/lgs_index.js`). The harvest requires only "pure" factories, whose whole body is `e => { e.exports = {…} }` (every CSS module; never a factory with side effects, which Steam's `require` would cache half-built if it ran early). It reports `{ok, size, factories, pure, bundle, minModules, why, builtAt, ms, current()}`; `current()` is false once Steam registers new factories (a lazily loaded chunk), and the next `on` rebuilds. `lgsIndexShared({minModules})` is the one way to use the shared cache `window.__LGS_INDEX`: it reuses it while `ok` and `current()`, caches a new one only when `ok`, and drops a cached one that is not (a 3-module index like the one of 06:50 is replaced by the next `on`, and also by `off` + `on`). `lgsWebpackRequire()` gets Steam's `require` and splices its probe record out of the chunk array again. Other evaluations that include `lgs_index.js` (the lab helpers, P6's reporter) should call `lgsIndexShared()` instead of caching `lgsBuildIndex()` themselves (REQs P1->P10, P1->P6).

Then one devtools session to SharedJSContext:

1. `await __LGS_RT.teardown('reload')` if a runtime is there (modules removed in reverse order).
2. The CSS core (`lgs_core.js`): one `<style>` per window, `html.lgs-on`. It re-checks readiness and the index and answers `{waiting: true, index}` without changing anything if they are not right.
3. Unless `--no-rt` or the flag `rt` is off: evaluate `00-rt.js` with the flag layers; then each `device/shared/*.js` and `device/rt/*.js` file in name order, **each in its own evaluation** (a syntax error fails only that file, recorded in `failedLoads`); then `await __LGS_RT.start()`.
4. **Fallback:** if the loader itself fails, the CSS theme stays on and the result says `runtime: {runtime: 'off', reason}` (Phase 1 behaviour).
5. With `vr` (the CLI): start `lgs-shell` with `native` = `on` (`--native`), `off` (`--css`) or `auto` (neither); `reload` and `dial` pass `None` (keep a running unit as it is). P8's `lgs_shell.start(native=…)` takes the strings once it declares `NATIVE_MODES = ('auto', 'on', 'off')`; until then `auto` maps to `defaults.json`'s `native` (`on` → native, otherwise keep / CSS only).

The JSON result has `index: {state: 'ok' | 'waiting' | 'gave-up', size, factories, pure, built, ms, current, cached, attempts, waitedS}` (also in `lgs status`) and `runtime: {runtime, modules: {name: state}, installed, failed: [...], flagsSet, loadMs}`.

### `lgs off`

1. `lgs-shell` stopped (native layer first).
2. `await __LGS_RT.teardown('off')`: modules removed in reverse install order; test hooks off; the popup callbacks unregistered; tracked globals deleted; `window.__LGS_RT` deleted.
3. The CSS core removed from every window.
4. A **sweep** of every popup window and SharedJSContext (one native XPath query per window, since R1).
5. Then, unless `--quiet`, the "Off" toast, so the sweep never counts it (review R1 mB1). `#lgs-toast` is P1's own transient node: it removes itself at most 2.4 s after it appears; a G-REMOVE sweep in that window may list it.
6. SteamVR pages stripped; `/tmp/lgs/flags.json` deleted (CLI only, not the lab's `--theme off`).

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

If `html.lgs-on` leaves the main window for **2 s** (another agent's `--theme off`, or any `__LGS.disable()`), the runtime removes every module and itself. A MutationObserver on main's class attribute arms a timer for exactly 2 s, so removal takes 2 s plus the teardown (a few ms; RT-5 measures it). The tick is a fallback: every **2 s** (a window reconcile and a check) while the observer watches main, every **250 ms** while it cannot (no observer, or no main window). Without a main window (e.g. right after a SharedJSContext reload) the CSS core itself is watched: `__LGS` gone or disabled for 2 s also removes the runtime (since R1, review m3). `__LGS.disable()` also calls `__LGS_RT.teardown('theme off')` directly. Nothing ever re-installs on its own: only `lgs on` does.

### The on/off toast

`lgs on`/`off` (not `--quiet`), the "+ > Liquid Glass" launcher and `lgs dial` show one toast in main: a panel-glass card (`class="lgs-glass" data-lgs-mat="panel"`, so the E3 edge while the theme is on), 320 × 76 (`--lgs-toast-w/-h`), radius 30 (`--lgs-r-toast`), a 48 px circular icon, title 20 px Semibold and body 18 px (`--lgs-text-2`), frosted (`--lgs-mat-thick-blur`) because it floats over in-page content, **no border, outline or ring**. Every value is a theme token with its literal value as fallback, so the theme-off "Off" toast looks the same. It is placed 16 px below the lowest control of the window's top rows in its column (toolbar, tabs, filters), never over them. Motion (Web Animations; P5's tokens read from the page, fallbacks = the token values): materialize `--lgs-d-mat-in` 250 ms linear (coverage by 28 %, swell `1 + 12/320` → 1) + translate −8 px → 0 on `--lgs-d-snappy`/`--lgs-ease-b15` (488 ms), content hidden until 35 %; after 1.9 s dematerialize `--lgs-d-mat-out` 350 ms on `--lgs-ease-mat-out`. Under Reduce Motion: an opacity fade of `--lgs-d-reduce` (180 ms) in and out, nothing else. RT-T checks it.

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
| `op(name, quiet=False, text=None, vr=False, native=None, flags=None, rt=None, wait=None, min_modules=None)` | `on` / `off` / `status` / `toast` as above. The lab calls `op('on'|'off', quiet=True)` (no `vr`): runtime included. `wait` (s, default `READY_WAIT_S` 120) and `min_modules` (default `MIN_CLASS_MODULES` 200) bound the readiness wait of `on` |
| `wait_ready(tokens, min_modules, wait)` | The readiness loop alone: `{state: 'ok' \| 'gave-up', attempts, waitedS, last}` |
| `flags_effective(cli=None)`, `flag_layers(cli=None)`, `BUILTIN_FLAGS` | §4 |
| `check(root=None, node=True)` | §6 |
| `visible_files(dir, suffix)`, `theme_css_files()`, `rt_sources()` | Listings with the `_wip` rule |
| `run_js(target, expr, timeout)`, `Session`, `targets()`, `find_target()`, `overlay_key()` | Phase 1 CDP plumbing, unchanged |
| `bundle_files(paths)`, `brace_error(text)`, `log(msg)`, `THEME_DIR`, `ROOT` | Unchanged (the bundler's `@keyframes`/`@property` warnings now ignore comments and strings) |
| `DIAL` | `/tmp/lgs/dial` since R1 (was `~/.local/share/glass-shell/dial`, which survived a reboot: rule 7). `lgs dial` is remembered until a reboot only |

---

## 8. Cost

- Load: one devtools evaluation per file (a few ms each) plus the modules' own `install` time.
- Idle (since R1): a MutationObserver on main's `<html>` class attribute and one 2 s tick (a window reconcile and a check); the 250 ms tick only while no observer watches main. No per-frame work. Measured on the Frame before R1 (4 Hz tick): 0.24 and 0.39 ms per second (RT-7 runs; this file said ≈ 0.1, which was wrong). After R1: see RT-7 in `wp/P1.md`. RT-7's budget is 1 ms per second (P1's own, not PLAN's).
- `lgs on`: one extra small evaluation (the readiness check with the theme's token list) and, when the cache is not current, a harvest of about 35–40 ms.

---

## 9. P1's test stubs

Defined inside `00-rt.js`, off by default:

| Module | Flag | Does |
|---|---|---|
| `rt.stub.a` | `rt.stubs` | `lgs-rt-stub` class and `data-lgs-rt-stub="<kind>"` on every window's `<html>` (RT-3); one `NavigationSource` subscription |
| `rt.stub.b` | `rt.stubs` | deps `rt.stub.a`; a bridge, a flag and a DOM listener, a 60 s interval |
| `rt.stub.c` | `rt.stubs` | deps `rt.stub.b`; async install and remove; `rt.expose('rtStubC', …)` |
| `rt.stub.throw` | `rt.stubThrow` | Sets a class, then throws in `install` (RT-2): the class must be gone and every other module installed |
| `rt.stub.slow` | `rt.stubSlow` | `install` waits 5.6 s (past its 5 s timeout), then marks main directly and subscribes through its dead `rt` (track, interval, timer, listener, `on`, `expose`) (RT-2): nothing may remain, and the late settle calls `remove()` again |

### `lgs selftest`: P1's acceptance tests on the live UI

```
python glass.py selftest [RT-1,RT-3,...] [--mode=pad|laser] [--json]   # from the PC (P10's passthrough, 1200 s); JSON -> shots/p1-selftest.json
python3 device/lgs.py selftest [...]   # on the Frame itself; not through `frame_ssh run` (its 120 s idle timeout kills it)
```

Each test prints `START <id> <time>` before it waits for any lock, and `PASS`/`FAIL <id> (<s> s)` at its end.

`--mode` runs every locked step with the lab's input-mode stub (P1's tests in both input modes, PLAN §2.1 M3). `RT-H` is not a PLAN id: it checks the test hooks live (§3.6: input stub through P3's `rt.input.stub` with TTL expiry, `flags.with`, `flags.push` TTL, action logger on inside a locked step), `rt.expose` and a daemon `echo` round trip through `rt.action`.

Each test takes the lab lock (`lab.Lock`, action logger on) only for its own steps and ends with the theme and runtime back on (session flags only); a `lgs-shell` unit that ran when the test began and stopped meanwhile (the daemon exits after 3 s of theme off) is started again in the same mode. Results: stdout (`PASS`/`FAIL` per test) and `/tmp/lgs/p1-selftest.json` (`{date, steamBuild, results: [{id, pass, detail, shell, seconds}]}`); exit 1 when any test fails. Durations on the shared device: RT-1 ≈ 10 s (+ lock waits), RT-2..RT-5 2–4 s each, RT-6 ≈ 35 s (control windows; holds `sync.lock` shared, takes `native.lock` only if free, for the full CLI cycle), RT-7 ≈ 45 s.

| Test | What `selftest` checks |
|---|---|
| RT-1 | warm-up on/off, then 3 × (`on --flags rt.stubs`, `off`): identical module states, Steam subscriber counts (popup created/destroyed, NavigationSource) and DOM listener counts (`getEventListeners` on main, bar, barpopup) in every on and every off; clean off reports (patchedLeft 0, no errors, no new marked element against the warm-up `off` sweep) |
| RT-2 | stubs + `rt.stubThrow` + two fixture files (a syntax error, a throw at load): `rt.stub.throw` failed with its error, the stubs installed, every other module in its usual state, `html.lgs-on` and the theme `<style>` on main, the failing stub's class gone, runtime running |
| RT-3 | "+" opened (`L.click('bar', '%{AddWindowButton}')`): the pooled `barpopup` window shown, `onShow` fired for it in `rt.stub.a`, `lgs-rt-stub` and `data-lgs-rt-stub="barpopup"` on its `<html>`; closed again |
| RT-4 | `off` sweep of every popup after (a) the stubs and (b) every defined module's flag on: no `__LGS_RT`, no `lgs-*` class, `data-lgs-*` attribute or `lgs-` id (against the baseline sweep; the core's own marks always count), `patchedLeft` 0, no globals left. Pass/fail is (a); (b) is the integration view |
| RT-5 | (a) the lab's `--theme off` path; (b) `html.lgs-on` removed from main alone (core sweep stopped): `__LGS_RT` gone ≤ 2.5 s, stub classes gone |
| RT-1 (R1) | also `Memory.getDOMCounters` after a forced GC (`HeapProfiler.collectGarbage`) before and after the three cycles: fail above 500 nodes or 10 JS listeners of growth per cycle |
| RT-2 (R1) | also `rt.stub.slow`: failed by timeout, its late scoped calls ignored (logged), no `lgs-rt-stub-slow*` class anywhere, `rtStubSlow` not exposed, `remove()` called again |
| RT-6 | write audit of this process (`sys.addaudithook`), a find scan of `~`, `/tmp`, `/var/tmp`, `/dev/shm`, `/run/user/<uid>` minus two control windows (before 8 s, **after 61 s**: longer than any once-a-minute writer such as vrserver's `chaperone_info.vrchap`, which is also a listed known writer), web storage of every window (local and session storage keys, IndexedDB database names, cookies matching `lgs`/`glass`), unit files and autostart entries. New files in Steam's web storage (`config/htmlcache/Default/{Local Storage, Session Storage, IndexedDB, …}`) and settings (`config/*.vdf`, `userdata/*/config/*.vdf`) are read and pass only without a Glass Shell marker (`__LGS`, `lgs-x`, `glass-shell`, …). The full CLI cycle (when `native.lock` is free) restarts `lgs-shell` in the mode it found, never `auto`. About 100 s |
| RT-7 | `L.perf('main', 3000)` on `/library/tab/AllGames`, theme only vs theme + runtime, ABBA × 2 (a second round pooled if the first fails): median fps ratio ≥ 0.95, median long frames (> 34 ms) ≤ theme-only median + its A/A spread (min 1), runtime tick < 1 ms per second. **Deviation for the coordinator to accept (review R1 m1):** the card says "no new frames over 34 ms"; on the shared device the theme-only runs alone differ by up to 7 long frames per 3 s, so "no new" is read as "no more than the A/A noise". Every run so far also met the strict reading (median extra ≤ 1) |
| RT-I | (R1, not a PLAN id) a harvest forced short (`op('on', wait=12, min_modules=100000)`): backoff attempts logged, gives up, changes nothing (theme version and runtime as before, nothing cached); a planted 3-module cache is rebuilt by the next `on`, and by `off` + `on`; no probe record left in `webpackChunksteamui` |
| RT-T | (R1, not a PLAN id) the toast (§5): panel glass, no ring, border or outline, radius 30, 320 × 76, clear of the top rows' controls, animations 250 ms (opacity + scale), 488 ms (translate), content 250 ms; under Reduce Motion (P10's `MediaHold`) only 180 ms opacity; the theme-off "Off" toast has the same computed look; removed by its timer within 2.7 s |

---

## 10. What other packages must provide

| Package | What |
|---|---|
| Every module | `remove()` safe after a partial install; a `{patchedLeft}` report if it patches Steam objects |
| P2 | `remove()` returns `{patchedLeft}`; `actions.*` honour `rt.test.actions.enabled()` |
| P3 | `rt.input.stub(mode, opts)` → `restore()` (contracts/interaction.md); `rt.test.input` forwards to it |
| P8 | Calls `__LGS_RT.bridge.set(key, value)` (and tolerates `__LGS_RT` being absent); reads `lgs.flags_effective()` or `/tmp/lgs/flags.json`; declares `NATIVE_MODES` once `start(native='auto'|'on'|'off')` works |
| P10 | `--flags` through `rt.test.flags.push/pop`; `check-theme` through `lgs.check()`; actions logger on in every step (recommended); the lab helpers take the index through `lgsIndexShared()` at call time |
| P6 | `lgs_layers.js` takes the index through `lgsIndexShared()` and splices its webpack probe record |

---

## 11. Changelog

| Date | Change |
|---|---|
| 2026-10-07 | First version (M1): registry, flags, windows, bridge, test hooks, liveness, loader, `lgs check`, `lgs flags`, cleanup report |
| 2026-10-07 | `rt.windows.onShow/onHide` and `entry.visible()` documented (pooled popups, RT-3). **Behaviour change:** `rt.bridge.set` notifies on every call (daemon.md §3 needs it); listeners get a 4th argument `changed`. New: `rt.action` (§3.5a), `rt.expose` (§3.5b), `status().exposed/actionsPending/idle`. Liveness acts on a timer at exactly 2 s |
| 2026-10-07 (R1) | Review R1 fixes. **Behaviour changes:** `lgs on` waits for Steam and a plausible class index (§5 step 0) and changes nothing when it gives up; the harvest runs only pure CSS-module factories; a short index is never cached and a bad cached one is rebuilt; a removed or failed module's `rt` is dead (§1 rule 2) and a timed-out `install` gets a second `remove()`; module files run in a strict wrapper; idle tick 0.5 Hz with the observer; liveness without main watches the CSS core; the "Off" toast comes after the sweep; the toast restyled (§5); `DIAL` in `/tmp/lgs`. New: `index` in the on/status result, `lgsIndexShared()`/`lgsWebpackRequire()`, `counts().vrNavigationType`, input-stub replay, flags `rt.stubSlow` and `shellThemeGraceS` (600), selftests RT-I and RT-T, RT-1 DOM counters, RT-6 61 s after-window and content check, `op(wait, min_modules)`, `wait_ready()` |
