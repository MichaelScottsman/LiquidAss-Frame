# Contract: the compositor, Steam side (P6)

Owner: **P6** (`device/lgs_layers.js`, `theme/layers/00-base.json`, `theme/layers/99-legacy.json`, `theme/layers.json` (retired), `theme/05-native.css`, `device/rt/08-popups.js`, `theme/popups/00-base.json`).

Readers:

- **P8** (daemon): injects the reporter, reads its reports, acks what the compositor shows (§6, §7).
- **P7** (scene graph): gets the pops, plates and mosaic bands through P8's spec (§6).
- **P9** (glassd): plates, holes and tints arrive through P8 in glassd's v3 fields (`contracts/glassd.md`).
- **Context packages** with a layer or popup fragment: C1a, C1c, C2a, C2b, C2c, C3a, C3b, C4b, C5a, C6a, C7 (§2 to §5, §8).
- **V1, V2, P10** (`sgcheck`, the native gate): the admission rules and the debug API (§4, §9).

Status: `docs/phase2/wp/P6.md` § Status says which parts are live on the Frame.

Everything is **backward compatible** until `99-legacy.json` is retired (PLAN §6): a Phase 1 `theme/layers.json` object still works as the reporter's whole configuration, and `00-base.json` + `99-legacy.json` reproduce its report exactly (RP-1).

Units:

- rects `x, y, w, h, r` in **Steam texture px** of that surface (CSS px × devicePixelRatio, 1.5 on gamepadui), origin top-left;
- `dz` in **scene units** (the numbers `lgs_sg.js` gets; NATIVE.md calls them "scene metres"). One unit is S × r metres for the main window and S metres for the bar and its popups (SP §1.1);
- `mm` fields are real millimetres at the **live** S and r: `units = mm / (1000 × S × r)` (PLAN §1.7). S and r come from P8's geometry (`rt.bridge` key `geom`, fields `S` and `r`); without it S = 0.369 and r = 1.

---

## 1. Who sets what

| What | Set by | Read by |
|---|---|---|
| `data-lgs-glass` on `%{BasicUiRoot}` (§2.1) | C1a (T2) | the reporter: main's cover shape |
| `data-lgs-plate` and its options on any element (§2.2) | areas (C1a ornament, C2a Home, C3b CC-M, C6a, C7 `/invites`, C1c flat modals) | the reporter: `plates` |
| `data-lgs-mosaic` bands (§2.3) | C2a (Home, folders) | the reporter: `mosaic` |
| `data-lgs-nopop` (§2.4) | C1a (bottom ornament), C7 (store ornament, `/invites` header nodes) | the reporter: admission rule 1 |
| `data-lgs-destructive` (§2.4) | C1c, C6a | the reporter: admission rule 4 |
| `data-lgs-media` (§2.4) | C5a, C7 (media regions that are not a `<video>`) | the reporter: admission rule 3 |
| `html.lgs-input-pad` / `html.lgs-input-laser`, `.lgs-dwell` | P3 | the reporter: which lift applies (§3.3) |
| Layer fragments `theme/layers/NN-name.json` (§3) | each area, NN = its theme number | the reporter, through P8 |
| Popup fragments `theme/popups/NN-name.json` (§5) | C1a, C2b, C3a | `device/rt/08-popups.js`, through P1's loader |
| `data-lgs-cover`, `data-lgs-pop`, `data-lgs-plate-ack` (§7) | the reporter, from P8's acks | `theme/05-native.css` and areas' native rules |
| Report (§6) | the reporter | P8 |
| `ack(map)` (§7) | P8 | the reporter |

---

## 2. DOM attributes the areas set

### 2.1 Glass mode: `data-lgs-glass`

On `%{BasicUiRoot}` of the main window (C1a). Values (PLAN §1.2):

| Value | Main's cover shape (CSS px, from the root's top-left) | Notes |
|---|---|---|
| `window` | the root's width × **656**, radius **54** | the 64 px ornament margin below stays uncovered: the ornament is a plate (§2.2) |
| `window-full` | width × **720**, radius 54 | |
| `hero` | width × 720, radius 54 | the art is opaque over it |
| `windowless` | **none** | every glass element is a plate |
| absent | Phase 1: the cover element's own box and radius | unchanged behaviour |

The heights and radii come from `00-base.json` (`surfaces.main.modes`); a fragment that `owns: ["main"]` may change them. An unknown value counts as absent and is listed in `errors`. The attribute is read from the main cover element, or from `modes.sel` (`%{BasicUiRoot}`) when the cover selector does not match (Home: the legacy cover selector excludes Steam's transparent Home).

### 2.2 Plates: `data-lgs-plate="<material>"`

An element with this attribute is reported as one **plate** of its surface: opaque glass at the cover's depth, drawn by glassd (`contracts/glassd.md` §1.3). Steam's real panel is hidden under it; the base mosaic shows Steam's content in front of it.

| Attribute | Value | Default | Report field |
|---|---|---|---|
| `data-lgs-plate` | `window`, `panel`, `liquid`, `thick`, `clear`, `dim` | `liquid` when empty or unknown | `material` |
| `data-lgs-plate-id` | a stable id (letters, digits, `-_.:`) | `p<n>` in document order | `id`. **Give one** whenever plates come and go (Home's discs), so materialize and acks follow the element |
| `data-lgs-plate-phase` | 0..1 | 1 | `phase` |
| `data-lgs-plate-appear` | `materialize` or `dematerialize` | — | `appear` |
| `data-lgs-plate-tint` | a CSS colour | — | `tint` |
| `data-lgs-plate-fill` | a CSS colour | — | `fill` |
| `data-lgs-plate-occluder` | `true` or `false` | auto (below) | `occluder` |
| `data-lgs-plate-r` | CSS px, or `capsule` | the element's computed `border-top-left-radius` | `r` |
| `data-lgs-plate-inset` | CSS px (positive shrinks, negative grows) | 0 | the rect |

- The rect is the element's visible box (clipped by its overflow ancestors and the window), in texture px. Hidden, transparent (opacity < .05) and off-screen plates are left out.
- **Occluder, automatic:** a plate that a reported pop overlaps gets `occluder: true` (HA §10.2: the focused cell's plate reads as its shadow). `data-lgs-plate-occluder="false"` turns that off; `"true"` forces it.
- At most **32** plates per surface (glassd G1); more are dropped in document order and named in `errors`.
- Plates are reported in every glass mode, also on the bar and popups.
- A plate is a container: make it ≥ 60 × 60 CSS px, or a capsule ≥ 44 tall (not enforced).

### 2.3 Mosaic bands: `data-lgs-mosaic`

The base mosaic (Steam's texture copied at +2 mm in front of the cover, NATIVE.md) normally covers the whole surface. On a windowless route that would draw labels and dots twice. So:

- Elements with `data-lgs-mosaic` declare the bands: the report's `mosaic` is their boxes (texture px). Keep it to about 4 bands (HA §10.2).
- In `windowless` mode without any `data-lgs-mosaic` element, the reporter builds the bands itself: plates whose vertical spans overlap are merged into one band from the leftmost to the rightmost plate, + 2 px on every side.
- In the other modes `mosaic` is absent: the whole surface (Phase 1).

### 2.4 Admission tags

| Attribute | Effect |
|---|---|
| `data-lgs-nopop` | No pop of an admission-on rule may overlap this element's box (rule 1): the bottom ornament, the store's navigation ornament, the `/invites` header nodes |
| `data-lgs-destructive` | An element that is, or contains, one never pops (rule 4): a confirmation with a red button stays flat |
| `data-lgs-media`, and every `<video>` | A pop that overlaps one is dropped (rule 3), unless its rule says `"media": "allow"` |

---

## 3. Layer fragments: `theme/layers/NN-name.json`

### 3.1 Loading and merging

- P8 reads `theme/layers/*.json` in **name order** (skipping `_wip/`) and passes them to the reporter as `layers: [{"file": "00-base.json", …the file's object…}, …]`. Without the folder it passes Phase 1's `theme/layers.json` object as before. The reporter accepts both forms (§9).
- `00-base.json` (P6) defines the **surfaces**: key or key prefix, cover, material, the glass modes, the modal selector. It has no layer rules.
- `99-legacy.json` (P6, temporary) holds Phase 1's layer rules with `"admission": false` (§4), so they report exactly as before.
- Each area adds `NN-name.json` (NN = its theme number, PLAN §2.6). Its rules come before the legacy rules (name order = priority: a layer that overlaps one kept earlier is dropped).

| Field (fragment top level) | Meaning |
|---|---|
| `version` | `2` (Phase 1's `layers.json` is 1) |
| `about` | Free text, ignored |
| `owns` | `["main", …]`: surfaces whose `cover`, `material`, `modes` or `modal` this fragment may replace. Without it those fields are an error in any fragment but the one that first defined the surface |
| `supersedes` | `["hdr-back", "main.footer", …]`: rule ids to drop from **other** fragments (a bare id matches on any surface, `surface.id` on one). Use it to retire the legacy rules you replace |
| `admission` | `true` (default) or `false` for every rule of this fragment (§4). Only `99-legacy.json` uses `false` |
| `defaults` | `{material, maxLayers, focusables}` for this fragment's rules |
| `surfaces` | `{name: surface}` |

Per surface (only the first fragment, or an owner, sets the first five):

| Field | Meaning |
|---|---|
| `key` / `keyPrefix` | Overlay key (exact), or the prefix of pooled popups (reported as `name.<suffix>`) |
| `cover` | `{sel, all, r, inset, outset, pseudo}`: the element(s) whose box is the surface's own glass. Selector tokens `%{Name}` resolve like theme CSS |
| `material` | The cover's material |
| `coverMm` / `coverDz` | Where glassd's cover and plates sit, mm / units (K-G6: the keyboard platter at −10 mm). Reported as `coverDz` |
| `modes` | Main only: `{attr, sel, window: {h, r}, window-full: {h, r}, hero: {h, r}, windowless: {cover: false}}` (§2.1) |
| `modal` | A selector for Steam's open modals (menus, alerts, sheets) on this surface (admission rule 6) |
| `frameKey`, `laserOnly`, `docVisibility`, `maxLayers` | As Phase 1 (`layers.json` `about`) |
| `layers` | Rules, appended in fragment name order. A rule id must be unique per surface; a duplicate is skipped and named in `errors` |

### 3.2 Rule fields

| Field | Meaning | Default |
|---|---|---|
| `id` | Slot id. The first match reports as `id`, later ones as `id.1`, `id.2` | `layer<i>` |
| `sel` | Selector (tokens allowed) | required |
| `pseudo` | `::before` / `::after`: the capsule is that pseudo-element | — |
| `mm` | Depth at rest in the **default** profile, mm, from the set {10, 15, 25} (§4) | — |
| `dz` | Depth in scene units (Phase 1). Ignored when `mm` is given | — |
| `liftMm` / `lift` | Extra depth while attended (§3.3), mm / units | 0 |
| `when` | `always` (pop whenever matched) or `attended` (only while focused by the gamepad or dwelt on by the laser, §3.3) | `always` |
| `focus` | Phase 1: the focus selector for `lift`, or `"always"` | `.gpfocus, .gpfocuswithin` |
| `wearer` | Overrides in the wearer profile: `{mm, liftMm, interactive, when}` (PLAN §1.7's "Wearer" column) | — |
| `interactive` | The crop takes the laser itself (wearer profile only, §4) | false |
| `profile` | `default` or `wearer`: the rule exists only in that profile | both |
| `modal` | `true` for menus, alerts and sheets: while one is open only modal rules pop (rule 6) | false |
| `hole` | `true` or `{shadow, y, blur, fill}`: glassd's hole treatment under the crop (G2). `fill` may be a CSS colour or `"scrim"` (black .35) | — |
| `tint` | Slab tint: a CSS colour, `"green"`, `"blue"`, or `"auto"` (the element's computed background colour when it is saturated) | — |
| `slab` | The slab's material: `liquid`, `panel`, `thick`, `window`, `clear`, or `"none"` (glassd draws only the hole; the glass is in-page, GP's cluster over art) | `liquid` (`defaults.material`) |
| `material` | Phase 1 name of `slab` | — |
| `exclude` | Selector: an element that matches it, or contains a match, does not pop | — |
| `media` | `"allow"` lets the pop overlap media (rule 3). Only with `hole` and a passing AT-HV-OFFAXIS | — |
| `flag` | A runtime flag name (P1 `rt.flags`): the rule exists only while the flag is on (e.g. `overArtPops`) | — |
| `from` | Where a **new** pop rises from (P7): units, `"cut"` (appears at its depth at once), or `fromMm` in mm | P7's default (0) |
| `sink` | `false`: removed at once when it leaves, instead of sinking back on `fade` (P7) | P7's default (true) |
| `r`, `inset`, `outset`, `max`, `hitTest`, `clip` | As Phase 1 | |

### 3.3 Lifts: laser and gamepad

A lift (`liftMm`, `lift`) or a `when: "attended"` rule applies to an element that is **attended**:

| Input mode (P3's class on that window's `<html>`) | Attended means |
|---|---|
| `lgs-input-pad` | the element matches `.gpfocus, .gpfocuswithin` (or the rule's `focus`) |
| `lgs-input-laser` | the element, or a descendant, matches `.lgs-dwell:hover` (P3 sets `.lgs-dwell` after 80 ms of dwell), so a 45 ms-per-card sweep lifts nothing |
| neither (P3 not loaded) | Phase 1: `.gpfocus, .gpfocuswithin` only |

---

## 4. The admission rules (PLAN §1.7)

Every rule with admission on (all but `99-legacy.json`) goes through these, in order. A dropped candidate is listed with its reason by `debug()` (§9).

| # | Rule | How the reporter decides |
|---|---|---|
| 0 | Profile | `profile` (rule) against the live profile: **wearer** when the flag `interactivePops` is true (`rt.flags`, or `opts.profile`), else **default** |
| 1 | Covered | The crop lies inside one of the surface's cover shapes or plates (2 px tolerance), and overlaps no `data-lgs-nopop` box |
| 2 | Click-safe (every non-interactive pop) | `s` = the shorter side (CSS px) of the smallest visible focusable (`focusables`, below) that is the element or inside it, and is visible in the crop by ≥ 8 × 8 px. Cap = `0.000521 × s` units. The wanted depth snaps **down** to the allowed set {10, 15, 25} mm at the live S, r; below 10 mm the pop is dropped. A capped layer carries `capped: true` and `want` (the wanted dz). No focusable inside: no cap (decorative crops: hero icon, avatar) |
| 3 | Not over media | The crop overlaps no visible `<video>` or `[data-lgs-media]`, unless `media: "allow"` |
| 4 | Not destructive | The element is not, and does not contain, `[data-lgs-destructive]` |
| 5 | Containers only | The crop is ≥ 60 × 60 CSS px, or a capsule (`r: "capsule"`) ≥ 44 tall and ≥ 60 wide |
| 6 | Still | Not while its scroller moves (as Phase 1). While the surface's `modal` selector (or a `modal: true` rule) matches a visible element, only `modal: true` rules pop |
| 7 | Few depths | More than 4 distinct dz at rest on a surface (0 counts) adds a warning to `errors`: `"main: 5 distinct depths (max 4): …"` |

- **Interactive:** a layer reports `interactive: true` only in the wearer profile and only when its rule (or its `wearer` block) says so. In the default profile every layer is `interactive: false` (RP-4).
- **Wearer profile:** the rule's `wearer` values replace `mm`, `liftMm`, `when` and `interactive`; interactive pops skip rule 2 (the click lands on the crop itself).
- `focusables` default: `.Focusable, button, [role="button"], a[href], input, select, textarea, [tabindex]:not([tabindex="-1"]), .gpfocus, .gpfocuswithin` (Steam drops `.Focusable` under the laser, so the tags are listed too).
- Admission-off rules (legacy) keep Phase 1's checks only (cover centre, overlaps, scroll, hit test).

---

## 5. Popup fragments and the wrapper: `theme/popups/NN-name.json`, `device/rt/08-popups.js`

### 5.1 What it does

`08-popups.js` is a runtime module (P1's `__LGS_RT.define`, name `popups`, flag **`wp.p6`**, off until RP-7 passes). While installed it:

- wraps `vrPooledPopupStore.SendPendingInstanceParamsToSteamVR(inst, params)` (every `ShowDashboardPopup` request goes through it: the first one, live updates and resizes) and `CreatePooledPopup(type, hookParams, cb)` (so `initialHookParams` carry the change from the start), as own properties of the store that shadow the prototype's methods;
- changes the request of each popup a host entry matches (§5.2), setting absolute values, so re-sending is idempotent;
- re-sends the live instances it changes once on install, and their **original** params once on removal;
- **restores** Steam's methods on `remove()`, and by itself (TTL) when the runtime that installed it is gone or the theme stays off for 3 s. A SharedJSContext reload drops the wrapper with the page; Steam then sends its own params again.

### 5.2 Fragment format

```json
{
  "version": 1,
  "about": "…",
  "owns": ["barpopup"],
  "hosts": {
    "barpopup":   {"type": 1, "zMm": 25, "space": "bar"},
    "frame.menu": {"type": 3, "set": {"only_visible_with_laser": false}, "flag": "tabBarAlways"}
  }
}
```

| Host field | Meaning |
|---|---|
| `type` | Steam's pooled host type (SP §3.1): 0 bar, 1 barpopup, 2 tooltip, 3 frame.menu, 5 volumelevel, 8 floatingfooter. Required |
| `keyPrefix` | Optional: the host window's overlay key must start with it |
| `contentSel` | Optional: a selector the popup's `contentElement` must contain (tokens allowed), to tell the "+" popup from other bar popups |
| `match` | Optional: `{field: value}` the request must already carry (e.g. `{"special_identifier": 3}`) |
| `zMm` | Depth toward the viewer, mm: sets `offset.z_meters` (scene units) and zeroes `offset.z_pixels` |
| `z` | The same in scene units (wins over `zMm`) |
| `space` | Units for `zMm`: `bar` (× S: the bar and its popups) or `main` (× S × r: the frame menu and popups parented to the window). Default: `main` for type 3, else `bar` |
| `scale` | Absolute `scale.scaler_value` |
| `set` | Request fields to set, only from: `only_visible_with_laser`, `interactive`, `inherit_parent_curvature`, `inherit_parent_pitch`, `sort_order` |
| `flag` | A runtime flag that must be on for this entry |

- Merge: fragments in name order. A host name is defined by one fragment; a later fragment changes it only with `owns`. `00-base.json` defines the names with no changes.
- The **last** matching entry in merge order applies to a popup (later fragments are more specific: `32-launcher.json`'s "+" entry with a `contentSel` wins over `30-bar.json`'s `barpopup`).
- Config source: P1's loader passes the fragments (`rt.data('popups')`, REQ P6->P1); for tests, `window.__LGS_POPUPS = [fragments]`.

### 5.3 API (`window.__LGS_POPUPS_API`, and `rt.popups` when P1 exposes module APIs)

| Call | Returns |
|---|---|
| `status()` | `{installed, wrapped, hosts, live: [{id, type, key, entry, z, scale, set}], resends, restores, ttl}` |
| `apply()` | Re-reads the fragments and re-sends the changed live instances |
| `restore(reason)` | Restores Steam's methods and params now (the same as `remove()`) |

---

## 6. The report (reporter → P8)

Version **3**. Phase 1 fields are unchanged (NATIVE.md "Steam → daemon"). New fields:

| Field | Where | Meaning |
|---|---|---|
| `v` | top | `3` |
| `profile` | top | `default` or `wearer` |
| `geom` | top | `{S, r, src}` used for `mm` → units (`src`: `bridge`, `opts` or `default`) |
| `errors` | top | Fragment problems and warnings (rule 7, dropped plates), ≤ 20 |
| `mode` | surface | main's glass mode (§2.1), or absent |
| `shapes` | surface | The cover's shapes; `[]` in windowless mode |
| `plates` | surface | `[{id, x, y, w, h, r, material, phase?, appear?, tint?, fill?, occluder?}]`, ≤ 32. Colours as CSS strings (`getComputedStyle` form) |
| `mosaic` | surface | `[{x, y, w, h}]` bands, or absent (whole surface) |
| `visible` | surface | true when a cover shape **or** a plate is on screen |
| `layers[].interactive` | layer | `true` only in the wearer profile (§4) |
| `layers[].capped`, `want` | layer | The click-safe cap lowered it; the wanted dz |
| `layers[].hole` | layer | `true` or `{shadow?, y?, blur?, fill?}` (glassd §1.4) |
| `layers[].tint` | layer | A CSS colour |
| `layers[].material` | layer | The slab material, `"none"` allowed |
| `layers[].modal` | layer | `true` for modal rules |
| `layers[].from`, `sink` | layer | Passed to P7 (`contracts/sg.md` §2) when the rule sets them |
| `coverDz` | surface | From the surface's `coverMm` (units at live S, r) or `coverDz`; absent = P7's default 0.001 |
| `window` | top | `{dim, recede}` asked for from Steam's side: `data-lgs-window-dim` (0..1, the window's brightness, CC-A) and `data-lgs-window-recede` (mm, the sheet-recede variant S7) on main's `<html>` or `%{BasicUiRoot}`; recede reported in units. Absent when neither is set |

With only the legacy configuration loaded, surfaces and layers carry none of the new fields (no `plates` when there are none, no `interactive` on admission-off layers), so RP-1 compares the surfaces byte for byte.

```json
{"seq": 41, "v": 3, "dash": true, "profile": "default", "geom": {"S": 0.369, "r": 0.863, "src": "bridge"},
 "surfaces": [
  {"name": "main", "overlayKey": "valve.steam.gamepadui.main", "visible": true, "texW": 1920, "texH": 1080,
   "radius": 81, "material": "window", "mode": "windowless", "shapes": [],
   "plates": [{"id": "disc-0", "x": 330, "y": 120, "w": 180, "h": 180, "r": 90, "material": "liquid"},
              {"id": "disc-1", "x": 666, "y": 120, "w": 180, "h": 180, "r": 90, "material": "liquid", "occluder": true}],
   "mosaic": [{"x": 328, "y": 118, "w": 1264, "h": 184}],
   "layers": [{"id": "cell", "x": 666, "y": 120, "w": 180, "h": 180, "r": 90, "dz": 0.0471, "material": "liquid",
               "interactive": false}]}
 ]}
```

P8 passes `plates` (and `mosaic`, `hole`, `tint`, `material: "none"`) to glassd and P7 when glassd's `caps` lists them; without `caps.plates` it may append plates to `shapes` (≤ 8).

---

## 7. Acks (P8 → reporter) and the attributes they set

`__LGS_LAYERS.ack(map)`, one key per overlay key in the scene-graph spec:

Two call forms are accepted: P8's `ack(popMap, {plates: plateMap})` (`contracts/daemon.md` §8), and the single-map form below.

| Value form | Meaning |
|---|---|
| `["id", …]` (Phase 1) | Pop ids shown; the cover counts as shown |
| `{"cover": bool, "pops": ["id", …], "plates": ["id", …]}` (v3) | What the compositor shows for that surface, each ≥ 350 ms after its push |
| key absent | Nothing of that surface is shown |
| `ack(null)` | Leave ack mode: every reported element is tagged at once (tests) |

| Attribute (set by the reporter only while acked) | On | Meaning for CSS |
|---|---|---|
| `data-lgs-cover` | each cover element | glassd draws this surface's glass: drop the CSS glass |
| `data-lgs-pop` = `self`, `before` or `after` | each popped element | glassd draws its slab: drop the CSS tint of that part |
| `data-lgs-plate-ack` | each plate element | glassd draws this plate: drop the plate's CSS fill, keep content |

An element must hold its id for 350 ms before an ack applies to it (ids are slots). `theme/05-native.css` (P6) drops the generic glass under `html.lgs-native` for these. Areas key their own native-mode rules on the same attributes, never on `html.lgs-native` alone.

---

## 8. `theme/05-native.css` (what areas can rely on)

Under `html.lgs-on.lgs-native`, outside `prefers-contrast: more`:

| Selector | Effect |
|---|---|
| `[data-lgs-cover]` on `%{BasicUiRoot}` | window glass background transparent, rim off |
| `[data-lgs-cover]` on bar segments, popup cards, Quick Access, tab and frame menus, floating footer | panel glass variables transparent |
| `[data-lgs-plate][data-lgs-plate-ack]` | `background: transparent`, `box-shadow: none`, `backdrop-filter: none` on the plate element itself, and `--lgs-plate-bg: transparent` for areas that paint the plate through that variable. Content, labels and focus stay |
| `[data-lgs-pop]` | the part's CSS tint and rim off; its backdrop blur stays (in-page refraction) |
| scroll-edge bands under tab rows | fade from a neutral scrim instead of the window tint |

---

## 9. JS API: `window.__LGS_LAYERS` (SharedJSContext)

Installed by evaluating `device/lgs_layers.js`. With `window.__LGS_LAYERS_OPTS` set beforehand it starts at once (P8's path).

| Call | Meaning |
|---|---|
| `start(rules, opts)` | `rules`: a Phase 1 object, or an array of fragments (§3.1), or JSON text of either. `opts`: `binding` (default `lgsLayers`), `ackMode`, `pingTtlMs`, `attrPrefix` (tests), `profile` (`default`/`wearer`, overrides the flag), `geom` (`{S, r}`, overrides the bridge), `flags` (`{name: bool}`, overrides `rt.flags` for tests) |
| `__LGS_LAYERS_OPTS.global` | Tests: install under another global name (e.g. `__LGS_LAYERS_T`), so a running daemon's instance is untouched |
| `stop(o)`, `ping()`, `ack(map)`, `resend()`, `forceDash(v)`, `overlay(ms)` | As Phase 1 (NATIVE.md) |
| `snapshot()` | The current report as an object (`v: 3`), computed fresh; emits nothing |
| `debug(name)` | Per rule and candidate: kept, or the admission rule that dropped it (`rule1-uncovered`, `rule2-click-safe s=40`, `rule3-media`, `rule4-destructive`, `rule5-small`, `rule6-modal`, `profile`, `flag`, …), and the plates |
| `rules()` | The merged configuration: surfaces, rule ids per surface with their fragment, superseded ids, errors |
| `status()` | As Phase 1, plus `v`, `profile`, `geom`, `fragments` |

---

## 10. Requests this contract makes of others

Filed in `docs/phase2/wp/P6.md` § Requests:

- **P8:** read `theme/layers/*.json` (name order, skip `_wip/`) and pass `layers: [ {file, …} ]`, falling back to `theme/layers.json`; ack in the v3 object form with `plates`; pass `plates`, `mosaic`, `hole`, `tint`, slab `material` and `interactive` through to glassd.json and the scene-graph spec; publish `geom` `{S, r}` on `rt.bridge`.
- **P7:** restrict the base mosaic to `mosaic` bands when present; make a pop's panel interactive only when the layer says `interactive: true`; place plates with the cover (same panel and `coverDz`).
- **P1:** pass `theme/popups/*.json` (name order) to the runtime as data (`rt.data('popups')`), and the flags `interactivePops`, `wp.p6` through `rt.flags`.
