# Contract: Steam React framework (P2, `rt.react`)

Owner: **P2**. Files: `device/rt/02-react.js` (module `react`), `device/rt/03-react-lab.js` (module `react-lab`, tests only). Source of truth for the mechanisms: `docs/phase2/capabilities/steam-react.md` (SR). Steam build at the time of writing: `11094443`.

Status of this contract: **v1 (M1)**. Signatures below are stable; additions are appended, never renamed. A change that breaks a caller is announced in `docs/phase2/wp/P2.md` under "Contract changes" before it lands.

---

## 0. Rules for callers (read first)

1. **Only from a runtime module.** Use `rt.react` inside your module's `install(rt)` (declare `deps: ['react']`) or later from your own handlers. Never at file load time.
2. **Fail closed.** Every call that needs Steam's modules first runs `rt.react.ready()`. If a required finder or the route switch is missing it **throws**, before anything is patched. Let it throw out of your `install()`: the loader marks your module failed and your area falls back to its T1 form (PLAN §5.2 rung 3).
3. **Nothing persists.** Everything lives in SharedJSContext's heap. `lgs off` calls `remove()`, which restores every fiber, holder and listener and reports `patchedLeft` (must be 0).
4. **New routes live under `/library/lgs/`** (SR §3.4: a stale history entry then falls back to Steam's library, not an empty page). `routes.add()` refuses anything else.
5. **Every interactive element is a `Focusable` or a Steam control** inside the page's `Focusable` tree (SR §7 "Focus traps"); the page root has an `onCancel` (`ui.Page` does this for you).
6. **Launch-type calls go through `rt.react.actions`**, never straight to `SteamClient`. In test mode they are logged, never run (§8). This is how the never-list is kept while 20 agents test.
7. **Strings** drawn by T3 come from `rt.react.ui.loc()` (Steam's localization); English fallbacks only when the UI language starts with `en` (PLAN §1.15).
8. Tests: call `rt.react.nav.focusRoot()` before any D-pad sequence (SR §4 `vr-null-tree`).

---

## 1. Module, flag, lifecycle

```js
__LGS_RT.define({ name: 'react', deps: [], flag: 'react', install(rt), remove() })
```

- **Flag `react`**, built-in default **on**. Turning it off is the kill switch for every T3 feature (callers that depend on `react` then fail to install and fall back to T1).
- **`install(rt)` is cheap** (< 5 ms): it creates `rt.react` and patches nothing. The source scan (≈ 160–200 ms, SR §5) runs **once**, on the first call that needs it (`ready()`, or any route, patch, component, data or action call). If no T3 caller is enabled, nothing is scanned and nothing is patched.
- **`remove()`** (called by `lgs off` in reverse load order): hides our menus and modals, leaves our routes (Back, then `/library/home` replace), restores every patched fiber, holder and history listener, drops the source cache, and returns `{patchedLeft, restored, routeAfter}`.
- **Self-healing:** if React remounts the route switch, the history listener re-patches it before the router renders into one of our paths or overridden paths (SR §3.4).

| Call | Returns |
|---|---|
| `rt.react.ready()` | `true`, or throws `Error('lgs-react: …')` naming the missing finders. Idempotent; a failure is sticky until `rt.react.reset()` (tests) |
| `rt.react.isReady` | boolean, no side effects |
| `rt.react.status()` | `{ready, error, scanMs, factories, finders: {Name: {module, candidates, required, found}}, switchFibers, patchedLive, routes: [...], overrides: [...], patches: [{id, kind, live, holders}], patchedLeft, actions: {mode, reason, logged}}` |
| `rt.react.version` | integer, bumped on every contract-visible change |

---

## 2. Steam's modules and finders

After `ready()`:

| Name | What |
|---|---|
| `rt.react.React`, `rt.react.jsx`, `rt.react.jsxs`, `rt.react.Fragment` | Steam's React 19 instance and jsx runtime. **Always use these**, never a second React |
| `rt.react.ReactDOM` | `createPortal`, `flushSync` |
| `rt.react.router` | `{Route, Switch, matchPath}` (react-router v5) |
| `rt.react.Routes` | Steam's route-path table (`Routes.Library.Home()`, `Routes.Settings.System()`, `Routes.Library.App.Root(appid)`, `Routes.GamepadUI.Zoo.Root()` …) |
| `rt.react.M` | every resolved finder by name (table below) |

**Your own finders.** `rt.react.find(spec)` runs over the cached factory sources (no second full stringify), requires only modules whose source contains every needle, smallest first, and returns the first pick that is truthy:

```js
const { mods, where, counts } = rt.react.find({
  QamVr: [['QuickAccess_Tab_Perf_PerfRecordTracking'], (ex, u) => u.pick(ex, (v, src) => …)],
});
```

- `u` = `rt.react.util`: `fnSrc(v)` (source of a function, class `prototype.render`, forwardRef `.render` or memo `.type`), `pick(exports, test(v, src, key))`, `has(src, ...needles)`.
- **Rule (SR §3.2):** a finder must match exactly one module. If `counts[name] > 1`, tighten its needles before relying on it; each extra candidate is a module that could be executed early.
- Required finders (fail closed): `React`, `jsx`, `RoutePaths`, `Focusable`, `DialogButton`, `GamepadPage`. Everything else is optional and is `null` when missing; check before use.

---

## 3. Steam's components (re-exports)

`rt.react.c` (also spread on `rt.react` itself):

`Focusable`, `DialogButton`, `DialogButtonPrimary`, `Field`, `ToggleField`, `SliderField`, `DropdownField`, `GamepadPage`, `ScrollPanel`, `ScrollPanelGroup`, `Menu`, `MenuItem`, `MenuSeparator`, `ConfirmModal`, `showModal`, `showContextMenu`.

Props reference: SR §3.6 (GamepadPage, Focusable navigation props, gamepad events, `flow-children` values, EGamepadButton codes). Optional components may be `null`; render a T1-equivalent or skip.

---

## 4. Routes

### 4.1 `rt.react.routes.add(path, Component, opts?) → handle`

- `path`: a react-router v5 path string under `/library/lgs/` (params allowed: `/library/lgs/folder/:id`). Anything else throws.
- `Component` receives `{match: {path, url, params, isExact}, location}`; it re-renders on every navigation of the main window.
- Rendered inside Steam's own `<Route>` wrapper type (the one Steam uses for `/zoo`), so it gets Steam's header, footer legend and transitions, and inside `ui.ErrorBoundary` (a failure shows a page with a focused Back button; Steam's other routes are untouched).
- `opts.exact` (default `false`, react-router semantics). Our routes are matched **before** Steam's, most specific (longest path) first.
- `handle = {path, remove()}`. `remove()` leaves the route first if the main window is on it.
- Two packages may not add the same path: the second `add()` throws.

### 4.2 `rt.react.routes.override(path, fn, opts?) → handle`

- `path`: the `path` prop of one of Steam's **top-level** `<Route>` elements, exactly as Steam declares it (use `rt.react.Routes`, e.g. `Routes.Library.Home()`). If no such element exists in the switch, it **throws**.
- `fn(steamChildren, {match, location})` returns what the route renders instead. It is called on every render of the switch: return an element, do no work. Keep `steamChildren` reachable when you redesign a whole page (SR §3.5).
- The result is wrapped in `ui.ErrorBoundary` whose fallback is **`steamChildren`**: a failing override degrades to Steam's own page.
- If the main window is on `path`, it is re-entered once (`Navigate(path, true)`) so the override applies. `handle.remove()` does the same so Steam's page comes back.
- One override per path; a second one throws.
- Sub-routes of a top-level route (for example `/app/:appid/controllerconfigurator/summary`) are rendered by Steam's children; an override of the top-level path wraps all of them.

### 4.3 Other

- `rt.react.routes.list()` → `{added: [path], overridden: [path]}`.
- `rt.react.nav`: plain navigation helpers, **not** actions (never logged): `route()`, `go(path, replace?)`, `back()`, `focusRoot()` (`FocusApplicationRoot()`), `inst()` (Steam's main window instance), `win()` (main window `window`). Use `nav.go` for navigation inside our own views (sections, folders); use `actions.navigate` for the user-intent jumps listed in §8.

---

## 5. Patches by props shape

### 5.1 `rt.react.patch.byProps(id, predicate, wrap, opts?) → handle`

For components whose source is hidden (mobx `observer`, memo, minified), found by the shape of their props (SR §3.2).

- `id`: unique string, `'<pkg>.<what>'` (for example `'c2b.plus'`).
- `predicate(props, fiber)`: tested on mounted fibers of function, class, forwardRef and memo components (tags 0, 1, 11, 14, 15) across SharedJSContext's single React root (main window and every popup).
- `wrap(orig)`: returns the replacement **render function**, called with the same `this` and arguments as `orig`: `(props, refOrContext)` for function/forwardRef/memo components; no arguments for a class `render` (use `this.props`). Typical "after" patch:

```js
rt.react.patch.byProps('c2b.plus', rt.react.patch.targets.plusButton, (orig) => function (props, r) {
  const out = orig.call(this, props, r);
  return out;                                         // modify or wrap the output here
});
```

- **What is patched:** the shared holder when there is one (memo `.type`, forwardRef `.render`, class `prototype.render`), so remounts keep the patch, **plus** every live fiber of that component (and its alternate), so the mounted instance switches at its next render without a remount. A bare function component has no holder: only live fibers are patched, and the handle re-applies itself on every main-window navigation and new popup window.
- **Layering:** several packages may patch the same component; wraps compose in registration order and each handle removes only its own layer.
- **Fail closed:** throws if nothing matches (`opts.optional: true` returns a handle with `count: 0` and keeps looking on navigation), or if more than `opts.max` (default 1) distinct components match.
- `handle = {id, count, refresh(), remove()}`.
- Re-render: `rt.react.patch.rerender(handle)` forces one update of the live instances (a no-op state flip on the nearest stateful ancestor), for patches that must show at once.

### 5.2 Named predicates (`rt.react.patch.targets`)

| Name | Shape | Used by |
|---|---|---|
| `plusButton` | props keys exactly `['allowLaunchProgram']` (bar "+", a memo; SR §3.2) | C2b (HA §4) |
| `pagedSettings` | `Array.isArray(props.pages)` and a page with `route === Routes.Settings.System()` | C6a (SET P-S1) |
| `statusPill` | filled in by C3b's CC3 probe; until then `null` | C3b |
| `appButtons` | filled in by C5a; until then `null` | C5a |

Packages that discover a new stable predicate send it to P2 as a REQ so it lands here.

### 5.3 Fiber utilities (`rt.react.fiber`)

`of(domNode)`, `root()` (HostRoot), `findAll(predicate, {max})` → fibers, `closest(domNode, predicate)` → nearest ancestor fiber, `props(domNode)` → the `memoizedProps` of the nearest component fiber. Read-only.

---

## 6. UI helpers (`rt.react.ui`)

| Helper | What |
|---|---|
| `ui.Page` | Component. `GamepadPage` (`scrollable: false` unless given) whose root is a `Focusable` with `onCancel` (default `nav.back()`) and `onCancelActionDescription` = Steam's "Back". Props: `onCancel`, `className` (root), `pageProps` (passed to `GamepadPage`), `children`. Includes `ui.ErrorBoundary` |
| `ui.ErrorBoundary` | Component `{name, fallback, children}`. On error: logs to the runtime log and renders `fallback` if given, else a page with a focused Back `DialogButton` |
| `ui.menu(content, anchor?, opts?)` | Steam's `showContextMenu`. `content` is a React element or an array of `{label, onSelected, tone, disabled, checked}`; `opts.label` the title. Returns the instance (`.Hide()`). In the main window it is Steam's centred gamepad sheet, with Steam's own Cancel |
| `ui.modal(element, opts?)` | Steam's `showModal(element, window)`; default window the main window. Returns the instance (`.Close()`). Overlays the route without unmounting it (RX-3) |
| `ui.confirm(opts)` | `ui.modal` of Steam's `ConfirmModal`: `{title, description, okText, cancelText, middleText, onOK, onCancel, onMiddle, alert}` |
| `ui.loc(token, ...args)` | Steam's localized string for `#Token`, or `null` when it does not exist |
| `ui.style(css)` | Component: a `<style>` inside your page's tree (lives and dies with it, SR §3.6) |

---

## 7. Data helpers (`rt.react.data`, read-only)

| Helper | Returns |
|---|---|
| `data.app(appid)` | Steam's app overview or `null` |
| `data.collection(id)` | a Steam collection (`collectionStore.GetCollection`) or `null`; `data.stores()` → `{collectionStore, appStore, urlStore}` |
| `data.installedGames({limit, sort})` | `[{appid, name, overview}]`, `sort: 'recent'` (default) or `'name'` |
| `data.recentGames(limit)` | from `recentAppsCollection` |
| `data.art(appidOrOverview)` | `{portrait: [urls], hero, logo, header, icon, custom: {hero, logo, landscape, portrait}}`, cached `/assets/` URLs first (SR §3.7) |
| `data.useNonSteamApps({enabled, refresh, includeLiquidGlass})` | **Hook.** Steam's own scan and filter of the "+ > Launch Program" list (developer mode honoured). `null` while scanning, then `[{key, name, exePath, cmdline, iconUrl, isLiquidGlass, raw}]`. **`key` is `strCmdline`** (SR §4). The Liquid Glass entry is left out unless `includeLiquidGlass` (HA-10) |
| `data.useDevMode()` | Hook: Steam's developer-mode flag |
| `data.filterPrograms(list, devMode)` | Steam's filter on a raw scan list |

---

## 8. Actions (`rt.react.actions`)

The only way T3 views launch or leave. Each returns `{fn, arg, mode, reason}` with `mode` one of `executed`, `logged`, `refused`.

| Action | Steam's call (the same one Steam's own control makes) |
|---|---|
| `launchNonSteam(cmdline, ev?)` | `SteamClient.Apps.LaunchNonSteamApp(cmdline)` ("+" popup row) |
| `primary(appid, ev?)` | Steam's primary action for the app (the library tile menu's first item: Play, Install, Update, Resume) |
| `desktopWindow(windowId, ev?)` | Steam's `DashboardDesktopWindowClicked({window_id})` ("+" popup window row) |
| `navigate(path, opts?, ev?)` | `Navigate(path, opts.replace)`: user-intent jumps (a game page, Steam's library tabs) |

**Test mode (log only, never run)** is on when **any** of these holds:

1. the runtime's action-logger test switch is on (P1, `contracts/runtime.md`), or `rt.react.actions.test(true)` was called;
2. the flag **`actionsLive` is not `true`**. Built-in default **false** for the whole build; V1 sets it in `defaults.json` at release (PLAN §1.17 safe default);
3. `ev` is a DOM mouse or pointer event with `isTrusted === false` (a synthetic lab click; a real laser click is trusted);
4. the test state cannot be read (fail closed).

`refused` means Steam's handler was not found: nothing runs and nothing is guessed.

| Helper | What |
|---|---|
| `actions.mode()` | `{mode: 'live' \| 'test', reasons: [...]}` |
| `actions.log` | ring of the last 200 `{t, fn, arg, mode, reason}` |
| `actions.onLog(cb)` | subscribe; returns unsubscribe |
| `actions.handler(name)` | the Steam function `name` would call (identity checks, HA AT-4) |
| `actions.test(on)` | test hook: force test mode on or off for a locked step (P10's `--flags` and P1's `rt.test` set it too) |

---

## 9. Lab route (`03-react-lab.js`, module `react-lab`, flag `reactLab`, default off)

Tests only. Installed only inside a locked step (`--flags reactLab`).

| Call | What |
|---|---|
| `rt.react.lab.fixture(name, factory)` | registers `factory(rt) → element` (Steam's component with fake props) |
| `await rt.react.lab.open(name \| element)` | adds `/library/lgs/lab`, navigates there, mounts the fixture inside `ui.ErrorBoundary`; resolves `{mounted, error}` |
| `await rt.react.lab.close()` | leaves the route and removes it; resolves `{routeLeft, nodesLeft}` |
| `await rt.react.lab.selftest(opts)` | RX-1: SR §6's selftest on a test page at `/library/lgs/lab/selftest` |
| `await rt.react.lab.run(id)` | runs one of P2's acceptance tests (`'RX-1'` … `'RX-7'`) and returns its report |

Built-in fixtures: `ConfirmModal` (no-op props), `buttons` (`DialogButton`, `DialogButtonPrimary`), `fields` (`ToggleField`, `SliderField`, `DropdownField` with local state only).

---

## 10. Failure and fallback summary

| Failure | What happens |
|---|---|
| A required finder misses, or the route switch is not found | `ready()` throws; nothing patched; every caller's `install()` throws; T1 everywhere |
| An optional finder misses | that export is `null`; callers skip or degrade |
| A route component throws | `ui.ErrorBoundary`: focused Back page (added routes) or Steam's own page (overrides) |
| React remounts the switch | re-patched on the next navigation into our paths |
| `patch.byProps` target not found | throws (or `count: 0` with `optional`) |
| Steam's action handler not found | `refused`, nothing runs |
| `lgs off` | `remove()`; `patchedLeft: 0` |
