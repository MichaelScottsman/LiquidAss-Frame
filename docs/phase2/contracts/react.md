# Contract: Steam React framework (P2, `rt.react`)

Owner: **P2**. Files: `device/rt/02-react.js` (module `react`), `device/rt/03-react-lab.js` (module `react-lab`, tests only). Source of truth for the mechanisms: `docs/phase2/capabilities/steam-react.md` (SR). Steam build at the time of writing: `11094443`.

Status of this contract: **v3** (2026-10-07, review R1 fixes; v2 was code complete and tested live: `docs/phase2/wp/P2.md`). Signatures below are stable; additions are appended, never renamed. A change that breaks a caller is announced in `docs/phase2/wp/P2.md` under "Contract changes" before it lands. What changed since v1 is in §11.

---

## 0. Rules for callers (read first)

1. **Only from a runtime module.** Use `rt.react` inside your module's `install(rt)` (declare `deps: ['react']`) or later from your own handlers. Never at file load time. `rt.react` is the module's API, put on the runtime object by P1's `rt.expose('react', api)` while `react` is installed, so it is the same object as `rt.use('react')` (and `__LGS_RT.react` in a lab step).
2. **Fail closed.** Every call that needs Steam's modules first runs `rt.react.ready()`. If a required finder or the route switch is missing it **throws**, before anything is patched. Let it throw out of your `install()`: the loader marks your module failed and your area falls back to its T1 form (PLAN §5.2 rung 3).
3. **Nothing persists.** Everything lives in SharedJSContext's heap. `lgs off` calls `remove()`, which restores every fiber, holder and listener and reports `patchedLeft` (must be 0).
4. **New routes live under `/library/lgs/`** (SR §3.4: a stale history entry then falls back to Steam's library, not an empty page). `routes.add()` refuses anything else.
5. **Every interactive element is a `Focusable` or a Steam control** inside the page's `Focusable` tree (SR §7 "Focus traps"); the page root has an `onCancel` (`ui.Page` does this for you).
6. **Launch-type calls go through `rt.react.actions`**, never straight to `SteamClient`. In test mode they are logged, never run (§8). This is how the never-list is kept while 20 agents test.
7. **Strings** drawn by T3 come from `rt.react.ui.loc()` (Steam's localization); English fallbacks only when the UI language starts with `en` (PLAN §1.15).
8. Tests: call `rt.react.nav.focusRoot()` before any D-pad sequence (SR §4 `vr-null-tree`).
9. **A `patch.byProps` wrap must not call React hooks.** It runs inside the live component's render, whose hook list is fixed; an extra hook crashes that component. Render a child component of your own (it may use hooks) from the wrap's output instead.

---

## 1. Module, flag, lifecycle

```js
__LGS_RT.define({ name: 'react', deps: [], flag: 'react', install(rt), remove() })
```

- **Flag `react`**: the kill switch for every T3 feature, and the module's P1 install gate (`define({flag: 'react'})`; P1's `BUILTIN_FLAGS` has `react: true`). Set to an off value (`lgs flags react=0`, or `--flags react=false` in a lab step), the module is removed, so every module with `deps: ['react']` is blocked and its area falls back to T1. `ready()` also refuses (`lgs-react: flag react is off`) while the flag reads off.
- **`install(rt)` is cheap** (0.1 ms measured): it creates the API, exposes it as `rt.react`, and patches nothing. The source scan (≈ 160–200 ms, SR §5) runs **once**, on the first call that needs it (`ready()`, or any route, patch, component, data or action call). If no T3 caller is enabled, nothing is scanned and nothing is patched.
- **`remove()`** (called by `lgs off` in reverse load order): hides our menus and modals, leaves our routes (Back, then `/library/home` replace), restores every patched fiber, holder and history listener, drops the source cache, and returns `{patchedLeft, restored, routeAfter}`.
- **Self-healing:** if React remounts the route switch, the history listener re-patches it before the router renders into one of our paths or overridden paths (SR §3.4).

| Call | Returns |
|---|---|
| `rt.react.ready()` | `true`, or throws `Error('lgs-react: …')` naming what is missing. Idempotent. A missing **required finder** is sticky until `rt.react.reset()` (tests). A **transient** failure (Steam's UI still mounting: `main route switch not found`, `no React fiber in the main window`, webpack not loaded) has `err.transient === true`, `err.retryAfterMs` and `err.attempt`: the same error is thrown until the backoff ends (1, 2, 4, 8, 16, then every 30 s), and the next `ready()` after it retries the switch lookup without scanning again (RX-RETRY). Your own `install()` still fails closed meanwhile; let the error out of `install()` unchanged (or as `cause`): P1 re-installs a module whose install failed with a `transient` error, after `retryAfterMs`, up to 4 times (runtime.md, REQ P2->P1) |
| `rt.react.isReady` | boolean, no side effects |
| `rt.react.status()` | `{version, installed, ready, error, scanMs, factories, finders: {Name: {module, candidates, required, found}}, switchFibers, patchedLive, routes: [...], overrides: [...], patches: [{id, count, live, kinds, pending, late}], patchedLeft, jsxHooked, watching, lateTimers, actions: {mode, reasons, logged}}`, plus `errorTransient`, `retryInMs`, `attempts` while `ready()` is failing. `watching`: the history and window listeners are on (anything registered, a pending optional patch included); `lateTimers`: late-attach timers still scheduled. `patchedLeft` counts our functions in Steam's objects right now (0 when nothing is registered, and after removal) |
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

- `u` = `rt.react.util`: `fnSrc(v)` (source of a function, class `prototype.render`, forwardRef `.render` or memo `.type`; it reads **through** our trampolines, so a predicate that checks the source still matches a component we already patched), `pick(exports, test(v, src, key))`, `has(src, ...needles)`.
- **Rule (SR §3.2):** a finder must match exactly one module. If `counts[name] > 1`, tighten its needles before relying on it; each extra candidate is a module that could be executed early.
- The source cache behind `find()` is kept 60 s after the last scan or `find()`, then dropped; a later `find()` scans again (≈ 80 ms).
- Live on build 11094443: all 25 built-in finders have exactly 1 candidate (`status().finders`). The scan searches one anchor needle per finder (its longest) and checks the others only on the anchor's modules: 143–165 ms on a busy device (76–94 ms when idle). Your own finders cost about 5 ms per distinct anchor needle when the cache must be rebuilt.
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
- `opts.exact` (default `false`, react-router semantics). Our routes are matched **before** Steam's, most specific (longest path) first. `opts.owner` (a string) is informational.
- `handle = {path, remove()}`. `remove()` leaves the route first if the main window is on it.
- Two packages may not add the same path: the second `add()` throws.

### 4.2 `rt.react.routes.override(path, fn, opts?) → handle`

- `path`: the `path` prop of one of Steam's **top-level** `<Route>` elements, exactly as Steam declares it (use `rt.react.Routes`, e.g. `Routes.Library.Home()`). If no such element exists in the switch, it **throws**.
- `fn(steamChildren, {match, location})` returns what the route renders instead. It is called on every render of the route: return an element, do no work. Keep `steamChildren` reachable when you redesign a whole page (SR §3.5).
  - `steamChildren` is Steam's own element for that route. Where Steam declares the route's children as a function of the route props (`/library/app/:appid/achievements`), it is that function's result for the current props, and `match` is the router's real match. Where Steam declares no children (`/chat`, and the `["/", "/index.html", "/sp.html"]` entry), it is `null`.
  - Steam's top-level paths on build 11094443, in order: `/oobe`, `/login`, `/createaccount`, `/account`, `/invites`, `/error`, `/library/downloads`, `/library/home`, `/app/:appid/properties`, `/console`, `/standalonecontrollerconfigurator`, `/app/:appid/controllerconfigurator`, `/library/app/:appid/achievements`, `/library/app/:appid`, `/library`, `/decksetup`, `/workshop`, `/chat`, `/media`, `/settings`, `/colorsettings`, `/search`, `/zoo`, `/about`, `/accessibility`, `/gameapiosk`, the root entry, `/controller/bindinput/:controllerIdx`, `/controller/devicesupport/:controllerIdx`, `/controller/calibration/:controllerIdx`, `/notes/app/:appid/:noteid?`.
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
- `predicate(props, fiber)`: tested on mounted fibers of function, class, forwardRef and memo components (tags 0, 1, 11, 14, 15) across SharedJSContext's single React root (main window and every popup). `opts.tags` (an array) narrows the tags.
- `wrap(orig)`: returns the replacement **render function**, called with the same `this` and arguments as `orig`: `(props, refOrContext)` for function/forwardRef/memo components; no arguments for a class `render` (use `this.props`). Typical "after" patch:

```js
rt.react.patch.byProps('c2b.plus', rt.react.patch.targets.plusButton, (orig) => function (props, r) {
  const out = orig.call(this, props, r);
  return out;                                         // modify or wrap the output here
});
```

- **What is patched** (`handle.kinds` names it per component):

| Kind | Component | How |
|---|---|---|
| `simplememo`, `memo` | `memo(fn)` (mobx `observer` components are this) | the memo's `.type`, plus every live fiber's `type` |
| `fwd` | `forwardRef` | its `.render` |
| `class` | class component | `prototype.render` |
| `fn` | a bare function component (no shared holder) | every live fiber's `type`, **and** while the patch exists Steam's element factories (`jsx`, `jsxs`, `createElement` of Steam's React) substitute our trampoline for that function, so a remount keeps the patch (RX-FN: PagedSettings). The first render after patching, and the first after removal, may remount the live instance once (React sees a new element type) |

- One stable trampoline per component carries every layer, so adding or removing a layer never changes the type React sees.
- **Layering:** several packages may patch the same component; wraps compose in registration order and each handle removes only its own layer. Every named target in §5.2 matches a component that is already patched (RX-OPT: a second layer on `appButtons`).
- **Fail closed:** throws if nothing matches, or if more than `opts.max` (default 1) distinct components match.
- **`opts.optional: true`** (for targets mounted only on some routes: `appButtons`, `pagedSettings`): when nothing matches, returns a handle with `count: 0`, `pending: true` and keeps looking: on every navigation of the main window, when a popup window is added or shown, and in a bounded series of scoped timers 120, 400, 1000 and 2500 ms after each of those events and after the registration itself (the history event comes before React commits the new route). A pending handle keeps the watchers on by itself, so it works as a package's **only** registration (RX-OPT). Once attached, `count`, `kinds` and `live` are filled in on the same handle and `patch.list()` shows `late` (the event that attached it). A pending handle that later matches more than `max` stays pending and logs the error.
- `handle = {id, count, live, kinds, refresh(), remove()}`: `count` distinct components, `live` mounted fibers switched at once.
- Re-render: `rt.react.patch.rerender(handle)` forces one render of the live instances, for patches that must show at once. Returns `{forced, skipped, how: {class, observer}}`: a class instance gets `forceUpdate()`; a mobx observer gets mobx's own update path (a new `stateVersion`, then `onStoreChange()`, exactly what an observable change does). Other components cannot be forced from outside (`skipped`); they show the patch at their next own render.
- `rt.react.patch.list()` → `[{id, count, live, kinds, pending}]`.

### 5.2 Named predicates (`rt.react.patch.targets`)

| Name | Shape | Used by |
|---|---|---|
| `plusButton` | props keys exactly `['allowLaunchProgram']`: the bar's "+" button, a mobx observer memo (tag 15) in the bar window. It owns the "+" popup (its hooks hold the popup handle) | C2b (HA §4). RX-2: 1 component, `rerender` forced, bar and popup unchanged by a no-op wrap |
| `pagedSettings` | `Array.isArray(props.pages)` and a page with `route === Routes.Settings.System()`: a bare function with props `{title, pages}` (27 page objects `{visible, title, icon, route, content}` on build 11094443) | C6a (SET P-S1). RX-FN: 1 component (kind `fn`), survives leaving and re-entering Settings, page unchanged by a no-op wrap |
| `statusPill` | a function component with **no** props whose first DOM node has Steam's `QuickAccessButton` class (read from the bar's CSS module, optional finder `BarClasses`, so it does not depend on the theme's class index; `rt.sel('%{QuickAccessButton}')` is the fallback); it renders Steam's bar popup button element (`{refBarPopupHandle, popupContents, interactionType, popupAlignment, onPopupVisibilityChange, tooltip, children}`), whose props a wrap may change | C3b (CC3). RX-TARGETS: 1 component (kind `fn`, an observer through hooks, so `rerender` forces it), bar unchanged by a no-op wrap |
| `appButtons` | the game page's action row: a forwardRef with `overview`, `details`, `onGameInfoToggle`, `bShowingLaunchDetails` and **no** `onNav` (its parent PlaySection has the same props plus `onNav`), whose source names `.ActionRow`. Its output holds the `%{AppButtons}` `Focusable` row | C5a (GP §4.12, AT-T3). RX-TARGETS |

Packages that discover a new stable predicate send it to P2 as a REQ so it lands here.

### 5.3 Fiber utilities (`rt.react.fiber`)

`of(domNode)`, `root()` (the committed HostRoot), `walk(visit)` (depth-first over every mounted fiber; `visit` returning `true` stops), `findAll(predicate(props, fiber), {max})` → fibers, `closest(domNode, predicate)` → nearest ancestor fiber, `props(domNode)` → the `memoizedProps` of the nearest component fiber, `firstHost(fiber)` → the first DOM node it renders. Read-only.

---

## 6. UI helpers (`rt.react.ui`)

| Helper | What |
|---|---|
| `ui.Page` | Component. `GamepadPage` (`scrollable: false` unless given) whose root is a `Focusable` with `onCancel` (default `nav.back()`) and `onCancelActionDescription` = Steam's "Back". Props: `onCancel`, `className` (root), `rootProps` (more props for the root `Focusable`), `pageProps` (passed to `GamepadPage`), `name` (for the error log), `children`. Includes `ui.ErrorBoundary` |
| `ui.ErrorBoundary` | Component `{name, fallback, onError, children}`. On error: logs to the runtime log, calls `onError(err)` if given, and renders `fallback` if given, else the error page: a root spanning the page (48 px side insets) with the title in Title 2 (English UI only, D-P2-6) and a focused 240 × 60 Back capsule on the centre line (`.lgs-react-fail`, `.lgs-react-fail-title`, `.lgs-react-fail-back`; P4 tokens with their values as fallbacks; RX-FAIL) |
| `ui.menu(content, anchor?, opts?)` | Steam's `showContextMenu`. `content` is a React element or an array of `{label, onSelected, tone, disabled, checked}`; `opts.label` the title. Returns the instance (`.Hide()`). In the main window it is Steam's centred gamepad sheet, with Steam's own Cancel |
| `ui.modal(element, opts?)` | Steam's `showModal(element, window, opts.options)`; `opts.window` defaults to the main window. Returns a **Promise** of the instance (`.Close()`). **Focus goes back** to the control that had it when the modal closes through Steam's `closeModal` (your `onCancel`/B, ConfirmModal's OK and Cancel): Steam parks focus in `vr-null-tree` after a modal in VR, so P2 activates the page's nav tree again and focuses its last node, if the route did not change and nothing else took focus (RX-3; `opts.restoreFocus: false` opts out). Your element is wrapped in a small host that forwards every prop Steam passes. Overlays the route without unmounting it (RX-3: the route's root stays the same node; only Steam's focus-dependent nodes such as `%{FastScrollOverlay}` leave while focus is in the modal). Steam passes your element a `closeModal` prop. Call `nav.focusRoot()` in tests before D-pad input |
| `ui.confirm(opts)` | `ui.modal` of Steam's `ConfirmModal`: `{title, description, okText, cancelText, middleText, onOK, onCancel, onMiddle, alert}`; a Promise of the instance |
| `ui.loc(token, ...args)` | Steam's localized string for `#Token`, or `null` when it does not exist. With `args`, `%1$s` … `%9$s` are filled from them (Steam's `LocalizeString` ignores extra arguments; REQ C2a->P2 #11); a placeholder without an argument stays |
| `ui.text(token, english)` | `loc(token)`, else `english` only when the UI language starts with `en`, else `null` (PLAN §1.15) |
| `ui.lang()` | Steam's preferred UI locale (`'english'` when unreadable) |
| `ui.style(css)` | An element: a `<style>` inside your page's tree (lives and dies with it, SR §3.6). `ui.Style` is the component (`{css}`) |

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
| `data.filterPrograms(list, devMode, {includeLiquidGlass})` | Steam's filter on a raw scan list (same row shape as the hook) |
| `data.isLiquidGlass(rawEntry)` | `true` for the Liquid Glass switch entry (exe `…/glass-shell/device/lgs` or the name "Liquid Glass") |

---

## 8. Actions (`rt.react.actions`)

The only way T3 views launch or leave. Each returns `{fn, arg, mode, reason}` with `mode` one of `executed`, `logged`, `refused`.

| Action | Steam's call (the same one Steam's own control makes) |
|---|---|
| `launchNonSteam(cmdline, ev?)` | `SteamClient.Apps.LaunchNonSteamApp(cmdline)` ("+" popup row) |
| `primary(appid, ev?)` | Steam's primary action for the app (the library tile menu's first item: Play, Install, Update, Resume), run exactly as that menu runs it: the same two functions, client `mostavailable`, launch source 1000 (library), and the window of `ev.currentTarget` (else the main window) |
| `desktopWindow(windowId, ev?)` | Steam's `DashboardDesktopWindowClicked({window_id})` ("+" popup window row) |
| `navigate(path, opts?, ev?)` | `Navigate(path, opts.replace)`: user-intent jumps (a game page, Steam's library tabs) |

**Test mode (log only, never run)** is on when **any** of these holds:

1. the runtime's action-logger test switch is on (P1, `contracts/runtime.md`), or `rt.react.actions.test(true)` was called;
2. the flag **`actionsLive` is not `true`**. Built-in default **false** for the whole build; V1 sets it in `defaults.json` at release (PLAN §1.17 safe default);
3. `ev` is a DOM mouse or pointer event with `isTrusted === false` (a synthetic lab click; a real laser click is trusted), **except** Steam's own programmatic click: an untrusted `PointerEvent` `click` with `pointerType ''` (pointerId -1). That is what Steam's `DialogButton` (`onClick`) and `MenuItem` (`onSelected`, so `ui.menu` items) dispatch for the gamepad's **A** (`HTMLElement.click()`), the gamepad path, so it does not count. Lab clicks are `MouseEvent`s (P10's `L.click`) and stay synthetic; a locked lab step is in test mode anyway through P10's action logger (reason 1), whatever its clicks look like (RX-7 gamepad phase);
4. the test state cannot be read (fail closed).

`refused` means Steam's handler was not found: nothing runs and nothing is guessed.

**Pass the event.** Give the action the event your control received: a `DialogButton`'s `onClick(ev)`, a `MenuItem`'s or `ui.menu` item's `onSelected(ev)`, a `Focusable`'s `onActivate(ev)` (a `vgp_onok` CustomEvent on A). All three are the user's own laser or gamepad press and run in the shipped state (`actionsLive: true`); only lab clicks and the test switches log instead.

| Helper | What |
|---|---|
| `actions.mode(ev?)` | `{mode: 'live' \| 'test', reasons: [...]}` (with `ev`, as an action with that event would see it) |
| `actions.primaryInfo(appid)` | `{appid, name, action, label, reason}`: the primary action Steam's tile menu would show (`'Play'`, `'Install'`, …) and its localized label, without running anything |
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
| `await rt.react.lab.open(name \| element)` | adds `/library/lgs/lab`, navigates there, mounts the fixture inside its own `ui.ErrorBoundary`; resolves `{mounted, error, route, nodes}`: a fixture that throws gives `mounted: false` and the error message (C7 labels it "unverified"; RX-OPEN) |
| `await rt.react.lab.openRaw(name \| element)` | the fixture as the **whole page** of a real added route, `/library/lgs/lab/raw` (no lab wrapper): what a package's `routes.add()` page gets; resolves `{route, failPage}` |
| `await rt.react.lab.close()` | leaves the route and removes it; resolves `{routeLeft, nodesLeft}` |
| `await rt.react.lab.selftest(opts)` | RX-1: SR §6's selftest on a test page at `/library/lgs/lab/selftest` |
| `await rt.react.lab.run(id)` | runs one of P2's acceptance tests (`'RX-1'` … `'RX-7'`) and returns its report |

Built-in fixtures: `ConfirmModal` (no-op props), `buttons` (`DialogButton`, `DialogButtonPrimary`), `fields` (`ToggleField`, `SliderField` with local state only), `boom` (a component that throws while rendering).

More of the lab API: `lab.fixtures()` (names), `lab.tests` (runner ids), `lab.events` (what the selftest page logged), `lab.where()` (where `.gpfocus` is, in lab terms), `lab.press('A'|'B'|'X'|'Y'|'MENU')` (dispatches a gamepad button **only** while focus is inside the lab page or its own menu and main is the active focus context; otherwise it throws).

Runners (`lab.run(id, L)`; pass the lab helpers `L` from `glass.py js`): `RX-1` … `RX-7` (PLAN §2.3), and nine for builds the RX list does not cover: `RX-OV` (overrides), `RX-HEAL` (self-healing), `RX-FN` (bare-function patch, PagedSettings), `RX-REMOVE` (the module's whole removal), `RX-TARGETS` (`statusPill`, `appButtons`), `RX-OPT` (optional patches as the only registration, layering on `appButtons`), `RX-RETRY` (transient `ready()` failure retried), `RX-FAIL` (the error page on a real added route), `RX-OPEN` (`lab.open()` error reporting). Run them as `python glass.py js --flags reactLab "__LGS_RT.react.lab.run('RX-1', L)"`; `RX-5`, `RX-6`, `RX-REMOVE`, `RX-OPT` and `RX-RETRY` refuse to run while another module has live routes or patches.

---

## 10. Failure and fallback summary

| Failure | What happens |
|---|---|
| A required finder misses | `ready()` throws (sticky); nothing patched; every caller's `install()` throws; T1 everywhere |
| The route switch or the main window's fiber is not there yet (UI mounting) | `ready()` throws a `transient` error; nothing patched; retried by the next `ready()` after the backoff |
| An optional finder misses | that export is `null`; callers skip or degrade |
| A route component throws | `ui.ErrorBoundary`: focused Back page (added routes) or Steam's own page (overrides) |
| React remounts the switch | re-patched on the next navigation into our paths |
| `patch.byProps` target not found | throws (or `count: 0`, pending, with `optional`; attached when it mounts) |
| Steam's action handler not found | `refused`, nothing runs |
| `lgs off` | `remove()`; `patchedLeft: 0` |

### 10.1 Test hooks (`rt.react.test`, lab only)

| Hook | What |
|---|---|
| `test.breakFinder(name)` | The next `ready()` treats that finder as missing (`null` clears). With `rt.react.reset()` this is RX-5 |
| `test.countPatchedLeft()` | Our functions still on fibers (type or elementType), holders, Steam's element factories |
| `test.cycle()` | The module's own removal (what `lgs off` runs), then a fresh unscanned state; returns the removal report. Every handle is dead afterwards |
| `test.dropSwitchPatch()` | Puts the original type back on the route switch fiber, as a React remount would (RX-HEAL) |
| `test.noSwitch(on)` | While on, `ready()` sees no route switch, as while Steam's UI mounts (a transient failure; RX-RETRY). Cleared by `reset()` |
| `rt.react.reset()` | Forgets a failed scan; refuses while routes, overrides or patches are live |

## 11. Changelog

| Version | Date | Change |
|---|---|---|
| v1 | 2026-10-07 | First version (M1) |
| v3 | 2026-10-07 | Review R1 fixes. **Behaviour changes a caller may notice:** (1) Steam's own programmatic click (untrusted `PointerEvent` `click`, `pointerType ''`: A on a `DialogButton` or `MenuItem`) is no longer a synthetic event, so actions run from the gamepad in the shipped state (§8); (2) an `optional` patch keeps looking when it is the only registration, with late-attach timers after each navigation (§5.1); (3) a transient `ready()` failure is retried after a backoff instead of being sticky (§1); (4) `ui.loc` fills `%N$s` from its arguments (§6); (5) `util.fnSrc` reads through our trampolines (layering on `appButtons`). (6) `ui.modal` gives focus back to the control that had it when the modal closes (Steam left it parked in `vr-null-tree`; `opts.restoreFocus: false` opts out). Additions: `ErrorBoundary.onError`; the error page spans the page and uses P4 tokens; `status().watching/lateTimers/errorTransient/retryInMs/attempts`, `patch.list()[].late`; `lab.open()` returns `{mounted, error, route, nodes}`, `lab.openRaw`, fixture `boom`, runners `RX-OPT`, `RX-RETRY`, `RX-FAIL`, `RX-OPEN`; `test.noSwitch`. `rt.react.version` is 3 (it stayed 1 through v2 by mistake) |
| v2 | 2026-10-07 | Code complete and tested live. `rt.react` comes from P1's `rt.expose`. Flag `react` is the module's install gate (§1, REQ P1->P2). Rule 9 (no hooks in wraps). Overrides: function children and `null` steamChildren (§4.2). Patch kinds incl. bare functions through element substitution; `rerender` semantics; `patch.list()` (§5.1). All four named targets filled and verified (§5.2). `fiber.walk`, `fiber.firstHost`; `ui.text`, `ui.lang`, `ui.Style`, `Page.rootProps`/`name`; `data.isLiquidGlass`; `actions.mode(ev)`, `actions.primaryInfo`; lab API and runners (§9); test hooks (§10.1). `DropdownField` is not in the `fields` fixture |
