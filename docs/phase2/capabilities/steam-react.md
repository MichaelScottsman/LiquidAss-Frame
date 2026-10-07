# Capability T3: new first-class views inside Steam's gamepadui ("steam-react")

**Status: proven on the live Frame**, 2026-10-07. Steam client build `11094443` (the constant every webpack module carries; the Phase 1 inventories were mapped on `11041156`), React **19.1.1**, react-router **v5**, Chrome 126.

Prototype: `device/proto/react_proto.js` (one JS expression; it defines `window.__LGS_PROTO`).

## 1. Result

We can add new views to the main VR window that are as native as Steam's own pages, entirely in memory:

- **A new route.** One React fiber is patched: the component that holds the main window's list of top-level `<Route>` elements. Its `type` is swapped for a wrapper that adds our `<Route>` element in front of Steam's. No Steam source is edited and nothing is written to disk.
- **Replacing what an existing route renders.** The same wrapper can clone Steam's `<Route>` element for a path (for example `/library/home`) and give it different children. This is the equivalent of Decky Loader's `routerHook.addPatch`.
- **Steam's own building blocks.** The page uses only Steam's components: `GamepadPage`, `Focusable` with `flow-children`, `DialogButton`, `ToggleField`, `Menu`/`MenuItem` with `showContextMenu`, and Steam's own data hooks.
  - D-pad focus, A, B, the Options (≡) button, the footer legend, laser clicks, focus memory, Steam's header and transitions all work with no extra code.
- **Steam's data.** Installed games come from `collectionStore` and art URLs from `appStore`. The "+ > Launch Program" list comes from Steam's own `ScanForInstalledNonSteamApps` hook and Steam's own filter lists.
- **Clean removal.** Removing restores the fiber types, the history listener and the global. A Steam restart or reboot also returns the stock UI, because nothing exists outside SharedJSContext's JS heap.

The selftest (section 6) passes 19 of 19 checks, run twice in a row, and each run ends with a clean removal.

## 2. Evidence

All shots are `main`, 1920x1080 (1.5x).

| Shot | What it shows |
|---|---|
| `shots/p2_react_proto_home.png` | Final prototype at `/library/lgs/proto` with the Glass Shell theme **off** (stock Steam colours): 3 installed games plus 3 Launch Program entries as circular tiles, the first tile focused, and a footer legend with "≡ Options / A Open (logged only) / B Back" taken from our action descriptions |
| `shots/p2_react_proto_libroute.png` | The same page with the theme **on**, `noFocusRing` on the tiles (only the disc ring shows focus) |
| `shots/p2_react_proto_focus.png` | Controller focus moved to row 2 with L.pad-style D-pad events (theme on; an older build without `noFocusRing`, so Steam's rectangular FocusRing is visible too) |
| `shots/p2_react_proto_menu.png` | The Options (≡) button on a tile opens a **Steam context menu** built from Steam's `Menu`/`MenuItem` (themed as glass by Phase 1 CSS) |
| `shots/p2_react_proto_home_override.png` | `/library/home` rendering our page instead of Steam's Home (route-render override). Steam's Home came back after `clearOverrides()`/`remove()`: 774 DOM nodes again |
| `shots/p2_react_proto_error_guard.png` | Our error boundary catching a forced render error. Steam's header and footer stay intact and Back is focused |
| `shots/p2_react_proto_after_remove.png` | An early `/lgs/proto` build after removal, navigated to again: an **empty page** (header and B Back only). This is why the default route moved under `/library` |
| `shots/p2_react_proto_removed_fallback.png` / `p2_react_libfallback_probe.png` | `/library/lgs/proto` after removal (and before any install) falls back to **Steam's own library page** |

## 3. Recipe

### 3.1 webpack require

```js
let req;
window.webpackChunksteamui.push([[Symbol('lgs')], {}, (r) => { req = r; }]);
// req.m = { id: factory } (2618 factories in this build); req(id) = exports.
// req.c (the module cache) is NOT exposed, so you cannot list loaded modules.
```

**Never call `req(id)` on every module.** `require()` of a module that nobody has loaded yet runs its top-level code. Filter by source text first, then require only the single module that defines what you need:

```js
function resolve(FINDERS) {               // FINDERS: name -> [needles[], pick(exports)]
  const cand = {}, size = {};
  for (const k in FINDERS) cand[k] = [];
  for (const id of Object.keys(req.m)) {
    const s = Function.prototype.toString.call(req.m[id]);
    for (const k in FINDERS) if (FINDERS[k][0].every((n) => s.includes(n))) { cand[k].push(id); size[id] = s.length; }
  }
  const out = {};
  for (const k in FINDERS) for (const id of cand[k].sort((a, b) => size[a] - size[b])) {
    const v = FINDERS[k][1](req(id)); if (v) { out[k] = v; break; }
  }
  return out;
}
```

`pick()` helper: an export's source is `Function.prototype.toString` of the function, of `.render` for a forwardRef, of `.type` for a memo, or of `prototype.render` for a class (see `fnSrc` in the prototype).

### 3.2 Module finders (source text, not ids)

Every finder below matched **exactly one** module live (`__LGS_PROTO.resolve()` prints the candidate counts). The ids are listed only so you can check them. They did not change between builds `11041156` and `11094443`, because webpack ids are deterministic, but **do not hard-code them**.

| Name | Needles in the module source | Pick | Id (11094443) |
|---|---|---|---|
| React | `react.production` | exports with `createElement`, `useState`, `version` | 51745 (re-exported by 63696) |
| jsx runtime | `react-jsx-runtime.production` | `{jsx, jsxs, Fragment}` | 3326 (via 62540) |
| ReactDOM | `react-dom.production` | `createPortal`, `flushSync` (`createRoot` is in `react-dom-client.production`, 98131) | 65473 |
| react-router v5 | `computeRootMatch`, `Router-History` | `Route` = class whose `prototype.render` has `computedMatch` and `.component`; `Switch` = `Children.forEach`; `matchPath` = function with `isExact` | 49519 |
| Route paths table | `"/zoo"`, `GamepadUI` | the object with `GamepadUI.Zoo.Root()` and `Library.Home()` (Steam's `Routes`) | 80344 |
| **Focusable** (Panel) | `"flow-children":`, `focusWithinClassName`, `"Panel"` | function whose source has `"flow-children"` | 38850 |
| **DialogButton** | `"DialogButton","_DialogLayout","Secondary"` | forwardRef with that string | 76982 |
| DialogButtonPrimary | `"DialogButton","_DialogLayout","Primary"` | the same | 76982 |
| Field | `spacingBetweenLabelAndChild`, `"keep-inline"` | function with both | 23477 |
| **ToggleField** | `"ToggleField"` | forwardRef with `"ToggleField"`; it looks up the gamepad flavour through Steam's component-provider context (`Zt("ToggleField")`) | 76982 |
| SliderField | `"SliderField"` | short function with `"SliderField"` | 50777 |
| DropdownField | `"DropDownField"` | short function with `"DropDownField"` | 50777 |
| **GamepadPage** | `useHeaderOpacitiesForGamepadPage`, `padForHeader` | forwardRef with `padForHeader`, `scrollable`, `headerVisibility` | 92275 |
| ScrollPanel | `scrollPaddingLeft`, `ScrollBoth` | forwardRef with `scrollPaddingTop`, `scrollDirection` | 52872 |
| ScrollPanelGroup (gamepad scrolling) | the same plus `scrollStepPercent` | forwardRef with `scrollStepPercent`, `onGamepadDirection` | 52872 |
| ConfirmModal | `bAlertDialog`, `strMiddleButtonText`, `bProgressDialog` | function with `bAlertDialog`, `strMiddleButtonText`, `closeModal` | 30583 |
| showModal | `bHideMainWindowForPopouts`, `bForcePopOut` | short async function | 12302 |
| showContextMenu | `GetContextMenuManagerFromWindow`, `CreateContextMenuInstance` | function with `CreateContextMenuInstance` and `.Show()` | 377 |
| Menu, MenuItem, MenuSeparator | `contextMenuCheckMark`, `bInteractableItem` | MenuItem = class with `bInteractableItem` and `OnOKButton`; Menu = short function with `labelId:` and `useId()`; Separator = `ContextMenuSeparator` | 12711 |
| useNonSteamApps (hook) | `ScanForInstalledNonSteamApps`, `useEffect` | the function that calls it | 68472 |
| Launch Program filters | `"vrurlhandler"`, `"Install Chromium"` | arrays: always-hidden `['steam','vrurlhandler']`; hidden unless developer mode `['firewall-config',…,'konsole',…]`; always shown by name `['Install Chromium']`; hook `useDevMode` = function with `"developer_mode_enabled"` | 5757 |

**Rule:** if a finder ever gets more than one candidate, tighten its needles before using it. Each extra candidate is a module that might get executed early. `install()` **fails closed**: it throws before patching anything if a required finder (React, jsx, RoutePaths, Focusable, DialogButton, GamepadPage) misses.

**mobx `observer()` components hide their source.** Their fiber `type` is a generic wrapper (`function(Qe,st){return Oe(function(){return Ue(Qe,st)},Pe)}`). Find those instances by **props shape** instead. Example: the bar's "+" button component is a memo fiber (tag 15) whose props are exactly `{allowLaunchProgram}`, 7 levels above `%{AddWindowButton}`. The same `type`-swap patch works on it.

### 3.3 The main window's route switch

Live structure (module 37730):

```
Y8 (observer: AppDetailsMain panel, FocusNavHistory)  ->  ErrorBoundary(errorKey = location.key)
  -> v8 = memo(() => <>
       <z6>{ ~31 top-level routes: Oobe, Login, …, Library.Home, AppProperties, Library.App, Library.Root,
             Settings.Root, Search.Root, Zoo.Root, About, …, ["/","/index.html","/sp.html"] }</z6>
       <Switch>{ AppRunning, Keyboard, AppOverlay }</Switch>   // overlay routes
     </>)
z6(props): loc = useLocation(); [el, match] = first child whose props.path (or from) matches (matchPath);
           renders TransitionGroup(className TopLevelTransitionSwitch) > transition(navKey = match.path) > cloneElement(el, {location, computedMatch})
```

- Route elements are Steam's wrapper `Jh` (module 72500), a `<Route>` that adds a "route disabled" context, or `Pc`, which shows "Loading" until services are initialised.
- **Reuse the element type of Steam's own `/zoo` route** for our route. Then our page gets exactly the same wrapper and transitions.

Find the switch structurally (no names): walk the fiber tree from the main window's React root. The match is the **function component** (tag 0) whose `memoizedProps.children` array contains both the `/settings` and `/zoo` routes:

```js
const inst = SteamUIStore.WindowStore.VRGamepadUIMainWindowInstance;
const doc  = inst.BrowserWindow.document;                 // main window ("VR_uid0")
const el   = [...doc.body.querySelectorAll('*')].find((n) => Object.keys(n).some((k) => k.startsWith('__reactFiber$')));
let f = el[Object.keys(el).find((k) => k.startsWith('__reactFiber$'))];
while (f.return) f = f.return;                            // HostRoot
// DFS child/sibling; match f.tag === 0 && Array.isArray(f.memoizedProps.children)
//   && children.some(c => c?.props?.path === Routes.Settings.Root())
//   && children.some(c => c?.props?.path === Routes.GamepadUI.Zoo.Root())
```

Popups (bar, barpopup, frame.menu, …) are portals of SharedJSContext's single React root. The same walk therefore reaches every surface. Exactly one switch was found.

### 3.4 Adding a route: patch the fiber's `type`

```js
function patchFiber(f) {
  const orig = f.type;
  const patched = function LgsRouteSwitch(props, second) {
    let children = [].concat(props.children);
    children = children.map((c) => {                       // 3.5: route-render overrides
      const fn = c && c.props && overrides.get(c.props.path);
      return fn ? React.cloneElement(c, { children: fn(c.props.children) }) : c;
    });
    if (ourRouteEl) children = [ourRouteEl].concat(children);   // first, so nothing shadows it
    return orig.call(this, { ...props, children }, second);    // same hooks, same order
  };
  patched.__lgsOrig = orig;
  f.type = patched;
  if (f.alternate) f.alternate.type = patched;                  // both current and work-in-progress
}
const RouteType = f.memoizedProps.children.find((c) => c?.props?.path === '/zoo').type;
ourRouteEl = jsx(RouteType, { path: '/library/lgs/proto', children: jsx(OurPage, {}) }, 'lgs-route');
```

Why this works and stays put:

- React's `createWorkInProgress` copies `type` from the current fiber. `z6` re-renders on every navigation because it uses `useLocation()`, so the next route change runs the wrapper.
- `elementType` is unchanged, so the parent's reconciliation (`v8` is a memo that never re-renders) keeps reusing the fiber.
- The wrapper calls the original as a plain function inside the same render, so the hook order is identical.

**Self-healing.** If React ever remounts the switch (a new fiber with the original `type`), the patch is gone. The prototype keeps a `m_history.listen()` callback that re-patches before the router renders into our path (`ensurePatched()`). For overrides of Steam routes the same idea applies: re-check on every navigation. A lost override degrades to Steam's own page, which is harmless.

**Route path choice.**

- Put new routes under **`/library/lgs/…`**. After removal, a stale history entry (Back, or Steam's backstack) then lands on Steam's `/library` route, which renders the stock library. That is shown in `p2_react_proto_removed_fallback.png`.
- A top-level `/lgs/…` path renders an **empty page** after removal (`p2_react_proto_after_remove.png`). B still works there, so it is not a trap, but it is a dead end.
- **Side effect of the `/library` prefix.** Steam's `BRouteMatch(Library.Root())` rules (window composition, header opacity lists in modules 56084 and 84978) treat the page as a library page. Live, the header (Back + search) and footer looked identical on both paths.

### 3.5 Replacing what an existing route renders

```js
overrides.set('/library/home', (steamChildren) => jsx(OurHome, { steamHome: steamChildren }));
inst.Navigate('/library/home', true);    // replace; re-renders the switch so the override applies
// restore: overrides.clear(); if on the path, inst.Navigate(path, true)
```

- `fn` receives **Steam's original children**. A replacement can therefore keep Steam's page reachable, for example by rendering `steamChildren` on another route such as `/library/lgs/steamhome`, or inside a tab of the new view. This is how "all functionality retained" can hold when a whole page is redesigned.
- Verified live: our page rendered at `/library/home` with controller focus on the first tile. `clearOverrides()` brought Steam's Home back (774 nodes).

### 3.6 Building the page from Steam's components

```js
jsx(GamepadPage, { scrollable: false,                     // false: a Focusable root; true: a ScrollPanel root
  children: jsxs(Focusable, { onCancel: back, onCancelActionDescription: 'Back', children: [
    jsx(Focusable, { 'flow-children': 'grid', children: items.map((it, i) =>
      jsx(Focusable, { autoFocus: i === 0, noFocusRing: true,
        onActivate: () => open(it),                          // laser click AND gamepad A
        onMenuButton: (e) => showContextMenu(menuEl(it), e.currentTarget, {}),
        onOKActionDescription: 'Open', onMenuActionDescription: 'Options',
        onGamepadFocus: () => …, children: … }, key(it))) }),
    jsxs(Focusable, { 'flow-children': 'row', children: [
      jsx(DialogButton, { onClick: back, children: 'Back' }),
      jsx(ToggleField, { label: 'Show labels', checked, onChange: (v) => … }) ] }) ] }) });
```

Reference, read from the live sources:

- **`GamepadPage` props:**
  - `padForHeader` (default true), `padForFooter` (true) and `flexed` (true).
  - `headerVisibility`: `'opaque'` (default), `'default'`, `'fadeInOnScroll'` or `'fadeInBackgroundOnScroll'`. Also `minimumOpacity`.
  - `scrollable` (default true, which renders a ScrollPanel), `background` (`'dialog'` adds Steam's dialog gradient; omit it for a transparent page) and `contentMaxWidth`.
- **`Focusable` (Panel) navigation props**, split by module 47428:
  - `autoFocus`, `preferredFocus`, `focusable`, `focusableIfEmpty`, `childFocusDisabled`, `fnCanTakeFocus`, `navRef`, `navKey`, `noFocusRing`, `focusRingSizeElementID`.
  - `onFocusWithin`, `resetNavOnEntry`, `navEntryPreferPosition`, `scrollIntoViewWhenChildFocused`, `scrollIntoViewType`, `onMoveUp/Right/Down/Left`, `actionDescriptionMap`.
  - Plus `flow-children`, `onActivate`, `onCancel`, `focusClassName` and `focusWithinClassName`. These are extra classes; the nav system always sets `gpfocus` and `gpfocuswithin`.
- **Gamepad events** (module 93046):
  - `onButtonDown/Up`, `onOKButton`, `onCancelButton`, `onSecondaryButton` (X), `onOptionsButton` (Y), `onMenuButton` (≡ Start), `onGamepadDirection`, `onGamepadFocus`, `onGamepadBlur`.
  - Footer labels come from `on{OK,Cancel,Secondary,Options,Menu}ActionDescription`.
- **`flow-children`:** `row`, `column`, `row-reverse`, `column-reverse`, `grid`, `geometric` (module 96485). Anything else asserts.
- **EGamepadButton** (module 20505): OK 1, CANCEL 2, SECONDARY 3 (X), OPTIONS 4 (Y), BUMPER_LEFT 5, BUMPER_RIGHT 6, TRIGGER_LEFT 7, TRIGGER_RIGHT 8, DIR_UP 9, DIR_DOWN 10, DIR_LEFT 11, DIR_RIGHT 12, SELECT 13, START 14 (≡).
- **Menus:**
  - `showContextMenu(jsx(Menu, {label, children:[jsx(MenuItem,{onSelected, tone?, disabled?, children})…]}), anchorEl, {})` returns an instance with `.Hide()`.
  - In the main window it renders as Steam's centred gamepad sheet, and Steam appends a Cancel item.
  - `SubMenu`, `CheckItem` (`bChecked`) and `Separator` live in the same module (12711). See `docs/inventory/shell.md` §0.2.
- **Modals:**
  - `showModal(jsx(ConfirmModal, {strTitle, strDescription, strOKButtonText, strCancelButtonText, onOK, onCancel, bAlertDialog?, strMiddleButtonText?, onMiddleButton?}), mainWindow)` returns an instance with `.Close()`.
  - A modal is an alternative container for an overlay panel (Control-Center-style tiles) that needs no route patch.
- **Styling:** a `<style>` element rendered inside the page's React tree. It lives and dies with the page, so there is nothing to clean up. Phase 1 theme rules (`html.lgs-on …`) still apply to Steam's components inside the page (menus, DialogButton, ToggleField, header).

### 3.7 Data sources

| Need | Source (read-only) |
|---|---|
| Installed games | `collectionStore.localGamesCollection.allApps` (18 here). Others: `allGamesCollection` (790), `vrAppsCollection` (`.visibleApps`), `recentAppsCollection`, `deckDesktopApps` (non-Steam shortcuts), `userCollections`, `GetCollection(id)` |
| One app | `appStore.GetAppOverviewByAppID(appid)`. Fields include `appid`, `display_name`, `app_type`, `rt_last_time_played`, `icon_hash`, `library_capsule_filename`, `local_cache_version`, `rt_store_asset_mtime`, `vr_supported`, `vr_only`, `size_on_disk` |
| Portrait art (600x900), offline | `appStore.GetCachedVerticalCapsuleURL(ov)` returns `['/assets/<appid>/<hash>/library_capsule.jpg?c=…', '/assets/<appid>_library_600x900.jpg?c=…']`. These load from the local cache in the popup document, and the prototype uses them. CDN fallback: `appStore.GetVerticalCapsuleURLForApp(ov)` |
| Hero, logo, header | `urlStore.BuildCachedLibraryAssetURL(appid, 'library_hero.jpg' \| 'logo.png' \| 'header.jpg', ov.local_cache_version)`, the same builder the capsule uses (not rendered in the prototype). User custom art: `appStore.GetCustom{Hero,Logo,Landcape,VerticalCapsule}ImageURLs(ov)`, empty when there is none |
| Icon | `appStore.GetIconURLForApp(ov)`: a 32 px community jpg (too small for large discs) or a `data:` URI for shortcuts |
| "+ > Launch Program" list | Steam's hook `useNonSteamApps(true, enabled, refreshCounter)` calls `SteamClient.Apps.ScanForInstalledNonSteamApps(true)`, read-only (26 entries). Each entry is `{bIsApplication, strAppName, strExePath, strArguments, strCmdline, strIconPath, strIconDataBase64}`. Then Steam's filter: keep if `strAppName` is in the always-shown list; drop if `strExePath` equals or ends with `/`+name of an always-hidden name, or of a developer-only name while developer mode is off. **Key rows by `strCmdline`**: several flatpaks share `strExePath` `/usr/bin/flatpak`, which Steam itself uses as the key |
| Actions (documented, **not executed**) | Program: `SteamClient.Apps.LaunchNonSteamApp(strCmdline)` (what the + popup row does). Game: navigate to Steam's game page `Routes.Library.App.Root(appid)` (`/library/app/<id>`), where Play keeps every Steam launch dialog |

### 3.8 Navigation and focus helpers

- `inst.Navigate(path, replace=false)` pushes (or replaces) and calls `FocusApplicationRoot()`.
- `inst.NavigateBack()` goes back. `inst.m_history` is a browser-style history v4 (base `/routes`), and `inst.m_arrBackstack` is Steam's logical backstack.
- `inst.FocusApplicationRoot()` re-activates the main window's navigation tree (section 4).

### 3.9 Removal

The prototype's `remove()` does this:

1. If the current route is ours, `NavigateBack()` and wait 900 ms. The exit transition is 200 ms, and the page unmounts through Steam's normal path. If Back did not leave, use `Navigate('/library/home', true)`.
2. Hide our context menu if one is open, call the history `unlisten()`, and set `type` back to the original on every patched fiber and its alternate. Clear the route element and the overrides, then `delete window.__LGS_PROTO`.
3. If the current route was overridden, `Navigate(route, true)` so Steam's page re-renders.

Verified after removal:

- `patchedLeft: 0`; the switch's `type` and its alternate are the original `z6`.
- No `[class*=lgsp-]` nodes and no leftover `<style>`.
- Navigating to the old path afterwards does **not** re-patch, which shows the listener is gone.
- Nothing matching `lgs` in localStorage or sessionStorage (shared or main window).

## 4. FocusNavController with new components (observed)

- **Registration.** New `Focusable`s join the main window's navigation tree through React context. No registration code is needed.
- **Initial focus.** `autoFocus` on the first tile takes focus when the route is entered: Navigate to page mounted took **106 ms**, and to the first tile focused **132 ms**.
- **Spatial moves.** In a 3x2 grid, `flow-children` `grid` and `geometric` both give spatially correct D-pad moves (the same results for an 11-step sequence). Edges do not wrap.
  - Up from the top row leaves the page into Steam's header search field. Down returns to the last focused tile.
- **Focus memory.** Groups remember their last focused child. Entering the button row from the grid a second time restores the toggle rather than the nearest button. The selftest accepts either result.
- **Duplicate React keys break navigation.** Seen with two programs keyed by the same `strExePath`.
- **Steam's floating `%{FocusRing}`** draws a rectangle around any focused `Focusable` unless it has `noFocusRing: true`. The Phase 1 theme restyles that ring. A custom focus look (the visionOS disc ring and scale) needs `noFocusRing`.
- **Laser.** A synthetic pointer click calls `onActivate` through `onClick`. `ToggleField` reacts to a click on the switch (`%{*GamepadDialogContent>Toggle}`), not on its label row, which is stock behaviour. A press of A on the focused toggle also works.
- **B and Options.** B on the page calls our root `onCancel` (here NavigateBack). With a menu open, B closes the menu first. ≡ (START, 14) calls `onMenuButton`.
- **Footer legend.** It shows our `on…ActionDescription` labels.
- **VR quirk: `vr-null-tree`.**
  - In VR, Steam picks the gamepad navigation tree from the SteamVR overlay that has input focus (`GetNavTreeForSteamVRGamepadFocus`, module 84114).
  - With the headset unworn there is no such overlay. Whenever a navigation tree is re-activated (after a menu or modal closes, or when another agent drives SteamVR pages), focus is parked in **`vr-null-tree`**, the navigation source becomes MOUSE (3), and no `.gpfocus` exists. Every `L.pad` then goes nowhere.
  - **Agents must call `inst.FocusApplicationRoot()`** before D-pad sequences, as `Navigate()` does. The prototype's `selftest` does this and retries a sequence that was interrupted.
  - In real use the overlay the user is aiming at decides. If the focused overlay is not Steam's, `CatchAllGamepadInput` forwards the gamepad to SteamVR.

## 5. Measurements (live, theme on)

| Metric | Value |
|---|---|
| `install()` (one source scan of 2618 factories, plus the fiber walk and patch) | 160–200 ms, once |
| Navigate to page mounted / first tile focused | 106 ms / 132 ms |
| Frame pacing on the page, idle (`L.perf main 3000`) | 89.9 fps, median 11.1 ms, p95 11.2 ms, 0 long frames |
| The same while moving focus 10 times (scale and box-shadow transitions) | 90.0 fps, p95 11.3 ms, 0 long frames |
| Library Home for comparison | 90.0 fps, p95 11.4 ms, 0 long frames |
| Page size | 43 DOM nodes |

The patched switch adds one array concat per route render (navigation only). There is no per-frame cost.

## 6. How agents verify it (no user needed)

```bash
python glass.py sync
MSYS_NO_PATHCONV=1 python glass.py eval SharedJSContext @/home/steamos/.local/share/glass-shell/device/proto/react_proto.js
python glass.py js "__LGS_PROTO.selftest({remove:true})"
```

- The file is about 35 KB, which is over the Windows command-line limit, so `glass.py js "$(cat …)"` fails. Load it from the headset copy instead. Loading only defines the API.
- `selftest` runs inside one locked lab step:
  - install, then open `/library/lgs/proto`;
  - move to the top-left tile, then 11 D-pad moves with expected targets;
  - a laser click on tile 2, which must log `activate`, and A on the focused tile, which must log `activate`;
  - ≡ opens Steam's context menu and B closes it;
  - B on the page leaves the route;
  - then `remove()`.
- It prints PASS or FAIL per check. Last two runs: `ok: true`, 19 of 19 PASS, `patchedLeft: 0`, global gone.
- Screenshots: `python glass.py shot main p2_x --pre "(async()=>{__LGS_PROTO.install(); __LGS_PROTO.open(); await L.sleep(1700); return L.focused('main')})()"`, then `python glass.py js "__LGS_PROTO.remove()"` right after.
- `press('A'|'B'|'X'|'Y'|'MENU')` dispatches a gamepad button **only** while `.gpfocus` is inside our page (or on an item of our own menu) and the main window is the active focus context. Otherwise it throws. Never use raw `FocusNavController.DispatchVirtualButtonClick(1|2|14)` on Steam's pages.

## 7. Risks

### Steam updates

- **Fiber internals are React-private.** The patch relies on: `__reactFiber$` keys on DOM nodes; `tag` 0 for function components; `memoizedProps.children`; `alternate`; and `createWorkInProgress` copying `type`.
  - All of this is stable through React 16–19, but a React major version could change it.
  - Mitigation: fail closed. `install()` throws before patching if the switch is not found, and `status().patchedLive` reports whether the patch is live.
- **The switch is found by shape** (an array of `<Route>` elements containing `/settings` and `/zoo`), not by name.
  - If Valve moves to react-router v6 or `useRoutes`, or splits the list, the finder returns nothing and Glass Shell falls back to CSS-only (T1/T2).
  - If Valve keeps a list but moves `/zoo` out of it, change the anchor paths.
- **Finders depend on literal strings.** CSS-module keys, prop names, string literals and loc tokens survive minification, and they survived the 11041156 → 11094443 update unchanged.
  - Each finder is narrowed to exactly one candidate, and `resolve()` shows the counts.
  - A renamed prop (for example `padForHeader`) breaks only that finder. Required finders fail closed; optional ones (ToggleField, Menu, the hooks) degrade gracefully.
- **Steam hooks used inside our components** (`useNonSteamApps`, `useDevMode`) can change their signature.
  - A throw inside our page is caught by **our own error boundary**, which shows a fallback page with a focused Back button (`p2_react_proto_error_guard.png`).
  - Without it, Steam's error boundary sits around **all** routes (`errorKey = location.key`), so one bad render would blank the whole window content until the next navigation.
  - Every new view needs this boundary.

### Focus traps

- **Every interactive element in a new view must be a `Focusable` or a Steam control** inside the page's `Focusable` tree. Plain DOM buttons would be laser-only, which breaks the "both input models" rule.
- **Give the page root an `onCancel`.** Otherwise B bubbles to `#GamepadUI_VR_Full_Root`, which opens the main menu.
- **Stale history entries after removal** (`m_arrBackstack` and browser history keep `/library/lgs/…`) fall back to Steam's library. Top-level paths would show an empty page. Keep new routes under `/library/lgs/`.
- **Focus can be parked in `vr-null-tree`** (section 4). Tests must re-focus the root, and production code needs nothing extra.
- **Overriding `/library/home`** hides Steam's Home content unless the override keeps Steam's children reachable (section 3.5).
- **Unstable React keys** (shared `strExePath`) and **`flow-children` values other than the six listed** cause misnavigation or an assert.

### Performance

- **Install cost.** The one-time scan stringifies all 2618 factories (about 150 ms of main-thread time in SharedJSContext, which also drives every Steam popup). Do it once per `lgs on` and keep the result. Never do it per navigation.
- **Rendering cost.** Our page rendered at a steady 90 fps. Big grids of art should:
  - use the cached `/assets/` URLs (local disk), not the CDN;
  - avoid a `backdrop-filter` per tile (one glass slab per group, or T5 glassd);
  - animate only `scale`, `translate` and `opacity`;
  - use a virtualized list for long libraries (Steam's library grid already virtualizes; a 790-app grid of plain DOM would not be cheap).

### Shared device and testing

Other agents navigate and drive SteamVR pages concurrently, and `vr:` steps use a different lock. Route, focus or theme can change between steps (one of our shots came out with the theme off because another agent turned it off).

- Do the whole test inside one locked step (`selftest`).
- Never schedule navigation in a `setTimeout` that outlives the lock. Only `remove()` (which leaves our own route) may run late.

### Persistence

- None. The patch, the listener, the global, the styles and the data all live in SharedJSContext's heap. Steam restart or reboot gives the stock UI.
- Integration rule: `lgs on` injects and installs, and `lgs off` calls `remove()`. Nothing may re-inject after a Steam restart (the lgs-shell daemon already exits when the theme goes off).

## 8. What T3 enables for Phase 2

- **A visionOS-style Home or app picker** as a real route: circular tiles at any size (the prototype uses 128 px discs, about 99 mm or 4.0° at the main window's scale) with focus scale and Steam's context menus. It can be its own route or replace `/library/home` while keeping Steam's Home reachable through `steamChildren`.
- **A full-window "Launch Program" grid** from the same data and filter as the + popup. Rows launch with `LaunchNonSteamApp(strCmdline)` (in the product, not in tests). The bar popup itself (a 300 px wide overlay) is drawn by an observer component, which was **located** (a memo fiber with props `{allowLaunchProgram}`) but not patched in this prototype. The same `type`-swap should apply; prove it before relying on it.
- **Larger targets and new layouts** anywhere inside the 1280x720 main window: tab capsules, sidebars and grouped rows built from `Focusable` and Steam's Fields, all gamepad-navigable.
- **Out of scope for T3:** anything outside the window's bounds, such as ornaments and tab bars floating beside the window, or depth. Those need T4 (scene-graph crops or our own panels) or T5 (glassd).
