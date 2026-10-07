# Coverage: area `settings`

Owner of `theme/60-settings.css`. Surface `main`, every `/settings/*` page plus the dialogs and menus opened from them.
Measured live on 2026-10-06/07 (Steam build of that day, theme bundle with all 9 area files present). All shots are 1.5x and live in `shots/`.
"Before" = the inventory's `--theme off` shot (`docs/inventory/settings.md`). "After" = `set_*_after` taken with `--theme on`.
Over-the-room review composites (shot over a synthetic room: bright window, lamp, dark sofa) were made locally from the same PNGs.

Controls (field rows, toggles, sliders, dropdowns, buttons, inputs, segmented radios, checkboxes, menus, modal sheets, focus ring) come from `10-primitives.css`. This file only adds the layout-level look and the page-specific widgets, inside settings containers.

## Scope

- Steam's `PagedSettingsDialog` is shared. The settings rules are scoped to `%{PagedSettingsDialog_PageList_ShowTitle>PagedSettingsDialog}:not(%{AppProperties}, %{NotesPagedSettings})`, so game Properties (appdetails) and Notes (social) keep their owners' look.
- `/zoo` (developer gallery, social area) uses the same plain dialog and picks up the same sidebar and page treatment. That is consistent; the social owner can opt it out (see Requests).
- Storage rules are scoped to `.BasicUI %{ContentManagement}%{InPagedSettings}` (only exists on `/settings/storage`). `.BasicUI` is needed because Steam's storage text rules reach (0,5,0).
- Dialog-only widgets (`%{BitRateTable}`, `%{AutoExplainer}`) are settings-only tokens and are written unscoped.

## What the settings layer does

| Element | Treatment (tokens) |
|---|---|
| Page roots `PagedSettingsDialog`, `PagedSettingDialog_ContentColumn` | Opaque `#0e141b` / `#1a1c21` cleared: the shell's window glass shows. No blur on the content column (the page scrolls in it). |
| Sidebar `PagedSettingsDialog_PageListColumn` | Opaque `#2b2d33` cleared. A raised pane is the column's `::before` (unused by Steam): inset 8/6/8/8 px, `--lgs-r-panel` (concentric with the 32 px window), `--lgs-panel-sheen` over `--lgs-fill-1`, `--lgs-glass-rim`. A fill, not glass (no glass on glass). `isolation: isolate` on the column keeps the pane under the list without touching any Steam z-index. Pointer-events none. |
| Page list items `PagedSettingsDialog_PageListItem` | Labels and icons `--lgs-text-1` + `--lgs-text-shadow`. Steam's blue gradients and 2 px left bar removed (colour only; border width kept). Capsule inset 3/14/3/16 px. Hover `--lgs-hover-fill`. **Focus** (`:focus`/`.gpfocus`): `--lgs-focus-fill` + `--lgs-focus-ring`. **Selected** (`Active`): white `--lgs-selected-fill` capsule, dark `--lgs-text-on-selected` label and icon, `--lgs-pill-shadow`. **Selected + focused**: the white pill gets a separated ring (2 px `--lgs-scrim` gap, 2 px `--lgs-focus-outline`, `--lgs-focus-glow`). Disabled item `--lgs-text-disabled`. The white pill is painted by the item's own background (two half-disc caps and a centre band, no overlap, so the translucent white stays even). It is real paint on the label's ancestor, so contrast tools see a dark label on white. Hover/focus fills and rings are the item's `::before` (the item's transform makes it the containing block and stacking context). Steam's `%{ScaledChildren}` 1.1 scale is untouched. |
| Group separators `%{PagedSettingsDialog>Separator}` | `--lgs-separator` hairlines. |
| Page title `.DialogHeader` | `--lgs-text-1` (the primitives add the text shadow). |
| Section headers `.SettingsDialogSubHeader` | `--lgs-text-2` + text shadow; `padding-inline-start: 12px` so they align with the row labels in the card below (a small padding tweak: no container geometry changed). |
| Body text `%{SettingsDialogBodyText}` / `%{SettingsDialogDescriptionText}` | `--lgs-text-1` / `--lgs-text-2`. |
| In-text links (`a` in the page: Family "Steam Families", In Game "Steam Networking", Downloads last-played) | No thin coloured text: `--lgs-text-1` with a `--lgs-text-3` underline, brightening to `--lgs-text-1` on hover and focus. Steam's FocusRing still marks focus. |
| Scroll edges | Mask on the page scroller `PagedSettingsDialog_PageContent`: content dissolves from 44 px to 4 px under the floating header capsules and over the last 22 px at the bottom. Mask on the page list: from 40 px to 16 px at the top and over the last 20 px. Masks only: no geometry or hit-testing change, and focused rows never reach the bands (Steam's scroll-padding is 250/60 px; the list's is 36 px). |
| Game Recording mode cards `%{RecordingModeOption}` | `--lgs-fill-1` cards, `--lgs-r-card`, `--lgs-control-rim`; hover `--lgs-hover-fill`; chosen mode (`%{WarningBox>Active}`) `--lgs-fill-3` + `--lgs-control-outline` edge; focus `--lgs-focus-fill` (!important), with Steam's FocusRing as the ring. Header `--lgs-text-1`, body `--lgs-text-2`. Radio pip: sunken well with an outline ring; active pip = white `--lgs-selected-fill` disc with a dark centre dot (the "selected" white). |
| Game Recording "High (Default)" suffix `%{BitrateSetting>Muted}` | `--lgs-text-2`. |
| Downloads "Game update timing" `%{FakeContainer}` | Matches the grouped card: `--lgs-fill-1`, `--lgs-r-card`, `--lgs-text-1`. |
| Bluetooth "Not connected" badge, "Available to pair" header | `--lgs-text-2`. |
| Notifications sticky headers `%{CheckboxHeaders}`, toggle-pair headers `%{NotificationSectionHeader}` | "Notify me via" `--lgs-text-2`; column labels `--lgs-text-1` + shadow; section header `--lgs-text-2`, "Show Toast / Play Sound" `--lgs-text-1`. Steam's sticky behaviour and its own 2 px column blur while scrolling are untouched. |
| Friends & Chat preview friend `%{FakeFriend}` | Name `--lgs-text-1`, status `--lgs-text-2`; avatar `--lgs-r-small`. The online blue stays as Steam's status-bar fill (semantic colour as a fill, not thin text). |
| Home `%{HiddenGameLabel}`, `%{GameCount}`, `%{Instructions}` | `--lgs-text-1` / `--lgs-text-2`. |
| Family `%{TrySteamFamiliesButton}` (Primary) | The page's one tinted action: `--lgs-tint-primary` whole capsule, white label (focus from the primitives: tint-lift + ring). |
| Storage drive tabs `%{InstallFolder}` | Capsules: rest `--lgs-fill-1` + `--lgs-control-rim`, name `--lgs-text-1`, size `--lgs-text-2`; hover `--lgs-hover-fill`; **selected** (`%{IsSelected}`) = white pill with a dark label (size at .66); focus = `--lgs-focus-fill` + `--lgs-focus-ring`; selected + focused = white pill + separated ring. |
| Storage usage bar `%{DriveUsageIndicator}` | Steam's striped track replaced by a `--lgs-fill-3` capsule + `--lgs-track-depth`. Category bars and legend dots keep their meaning, drawn from the system palette: Games `--lgs-blue`, Workshop `--lgs-green`, Shaders `--lgs-purple`, Non-Steam `--lgs-yellow`, Free `--lgs-fill-3` (Media keeps Steam's dark green). Path `--lgs-text-2`, legend labels `--lgs-text-1`, numbers `--lgs-text-2`. |
| Storage list | "Items" header `--lgs-text-1`, count `--lgs-text-2`, rule `--lgs-separator`. The list `%{LibraryInventory}` is one grouped card (`--lgs-fill-1`, `--lgs-r-card`, `--lgs-control-rim`). Rows `%{AppBody}` (virtualized, inline geometry untouched): `--lgs-r-row`; hover `--lgs-hover-fill`; focus `--lgs-focus-fill` + `--lgs-focus-ring` (!important). Names and sizes `--lgs-text-1`; values, `%{SpecialSectionText}` and icons `--lgs-text-2` (`--lgs-text-1` when focused). Small art (content) rounded `--lgs-r-small`. The sort dropdown is the Library area's control and is left alone. |
| Recording Quality dialog | `%{BitRateTable}` in a sunken well (`--lgs-well-bg`, `--lgs-well-shadow`, `--lgs-r-row`, `--lgs-text-1`); `%{AutoExplainer}` `--lgs-text-2`. The sheet, dropdown and buttons are the primitives'. |

Nothing hides, collapses or disables anything. No `position`/size/overflow/flex changes on Steam containers, and no Steam transform, transition or animation is touched. Steam's own pseudo-elements are not reused. Our `::before`s (sidebar pane, nav capsule) are pointer-events none.

## Screens and states

How to reach: the `--pre` snippets below use the inventory's prelude and helpers (`docs/inventory/settings.md` §0.3–0.4). Scrolled states: `--pre "(async()=>{const pc=L.q('main','%{PagedSettingsDialog_PageList_ShowTitle>PagedSettingsDialog_PageContent}'); pc.scrollTop=N; await L.sleep(450); return pc.scrollTop})()"`. Dialogs and menus are opened through the React `onClick` and closed by the step's cleanup (only Cancel, Close or click-outside are ever pressed). The modal count was verified 0 afterwards.

AUDIT_TABLE

## Performance (`python glass.py perf main --route R`)

PERF_TABLE

## Not styled / limits (and why)

LIMITS

## Requests to other owners

REQUESTS
