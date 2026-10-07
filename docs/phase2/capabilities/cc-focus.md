# CS10: CC-A gamepad focus spike (CC §4.11)

Owner: C3b. Result: **NOT RUN** (2026-10-07, session 2, expedited single session).

CC §4.11's ship gate says CC-A (the type-7 popup variant) ships only when this file records **PASS**. FAIL and
INCONCLUSIVE both mean "not shipped", and so does the absence of a run. **CC-A is not shipped.** CC-M (Control Center
in the main window, `device/rt/31-cc.js`, flag `wp.c3b`) is the default while Steam's main window is the page the
dashboard shows; on any other page the status pill opens Steam's own Quick Access (CC-C, restyled in
`theme/31-cc.css` part C), exactly as before.

No CC-A host code exists in the tree, so nothing depends on this result. To run the spike later, follow CC §4.11
steps 1-7 under `lab.lock` + `lab-vr.lock` and replace this file with the trace, the build ids and the verdict.
