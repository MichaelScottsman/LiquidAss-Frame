# C5a Game pages, achievements, Properties: independent review, round R2

Reviewer: an independent adversarial review agent. Date: 2026-10-07 (from 13:38). Steam build 11094443.
Scope: package C5a as its log (`docs/phase2/wp/C5a.md`) reports it, "READY: `wp.c5a`" (run with `wp.c1a`, `wp.p3`). Nothing in the builder's log is taken on trust.

## Status

**In progress** (session 1, from 13:38; last update 14:10). Static review of `theme/50-appdetails.css`, `device/rt/50-gamepage.js` and `theme/layers/50-gamepage.json` done (deployed copies md5-identical to the tree). Live CSS-only checks so far: title geometry and cluster navigation, tooltips, pin/unpin, shots of title, Activity, Your Stuff, Community, Game Info, achievements and Properties, gates on each details tab, achievements and Properties General. Early findings (to be written up): the details tabs fail G-SIZE / G-TYPE / G-OUTLINE (the builder gated only the title state); the stats values are clipped on the title view; the focused tab's glow is cut into a square frame by Steam's tab scroller. Still queued: Properties page walk, pad-bfs, focus pairs, removal, robustness, conformance, the native session.
