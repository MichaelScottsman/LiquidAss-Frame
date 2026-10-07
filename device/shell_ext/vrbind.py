"""Glass Shell C5b: the vrbind relay (GP §4.12, GQ11a-d; contracts/daemon.md §5).

Steam's game page (device/rt/52-vrbind.js, flag vrBindings) asks the daemon
to open SteamVR's controller bindings for one app:

  vrbind          (nav)   args {app: "steam.app.<digits>"}
      GQ11b+c: SteamVR's own deep link in vr:controllerbindingui,
      inputUI.OnShowAppBinding({app_key}): it updates the app list, shows the
      binding overlay in the dashboard (ShowOverlayInDashboard), selects the
      app in the binding UI and shows its binding list. Navigation only:
      never SelectConfig, Activate, Edit or any controllerBindingStore write
      (no controller_type is passed, so EditCurrentBinding is never reached).
      If the dashboard frame did not switch to the binding page within 1.5 s,
      it is switched with FrameStore's own SwitchToPage (GQ11c).
  vrbind.strings  (read)  args {}
      SteamVR's own labels ("#Controller_Bindings", "#VR_Controller_Bindings")
      from vr:systemui's LocalizationManager, for the capsule.

GQ11d, the way back: tick() watches the binding UI once a second while a deep
link is open. When the user leaves that app's binding list for the app list
(the binding UI's own Back, laser), the dashboard frame is switched back to
the page it showed before (Steam's). If the user went anywhere else (another
frame page, closed the dashboard), the deep link is forgotten and nothing is
switched. Nothing persists: state lives in this process only, and stop()
forgets it.

nav is never run while actionsDryRun or the runtime's action logger is on
(the daemon answers {ok, dry} instead), and the action is refused while the
flag vrBindings is off.
"""
import asyncio
import json
import time

ACTIONS = {
    "vrbind": {
        "args": {"app": {"type": "str", "re": r"^steam\.app\.\d{1,10}$"}},
        "sources": ["main"],
        "rate": 1.0,
        "kind": "nav",
        "flag": "vrBindings",
        "timeout": 10,
    },
    "vrbind.strings": {
        "args": {},
        "sources": ["main"],
        "rate": 0.5,
        "kind": "read",
        "flag": "vrBindings",
        "timeout": 5,
    },
}

BIND_KEY = "system.vrwebhelper.controllerbinding"
DEEP_TTL_S = 900          # forget a deep link after 15 min
APP_SELECT = 4            # inputUI state: the app list (SteamVR enum AppSelect = 4)

# vr:systemui: the dashboard frame that holds the binding page, its active page and the binding page id
JS_FRAME = """(() => {
  const fs = (window.FrameStore && FrameStore.frames) || [];
  const f = fs.find((x) => x.pages.some((p) => p.m_sSummonOverlayKey === %s));
  if (!f) return null;
  const p = f.pages.find((x) => x.m_sSummonOverlayKey === %s);
  return { frameID: f.frameID, active: f.activePageID, bindPage: p.pageID ?? p.m_unPageID, visible: !!f.isCurrentlyVisible };
})()""" % (json.dumps(BIND_KEY), json.dumps(BIND_KEY))

JS_SWITCH = """(() => {
  const f = FrameStore.frames.find((x) => x.frameID === %s);
  if (!f) return false;
  f.SwitchToPage(%s);
  return true;
})()"""

JS_STRINGS = """(() => {
  const L = window.LocalizationManager, out = {};
  for (const t of ['#Controller_Bindings', '#VR_Controller_Bindings']) {
    let v = null; try { v = L.LocalizeString(t); } catch (e) {}
    out[t] = v && v !== t ? v : null;
  }
  return out;
})()"""

# vr:controllerbindingui
JS_DEEPLINK = """(() => {
  if (!window.inputUI || typeof inputUI.OnShowAppBinding !== 'function') return 'no-inputUI';
  inputUI.OnShowAppBinding({ app_key: %s });
  return 'ok';
})()"""

JS_UISTATE = """(() => {
  const u = window.inputUI;
  if (!u) return null;
  return { state: u.GetUIState, loading: !!u.Loading };
})()"""


async def _frame(ctx):
    try:
        return await ctx.vr_eval("systemui", JS_FRAME, timeout=5)
    except Exception:  # noqa: BLE001
        return None


async def run(ctx, type, args):  # noqa: A002 (contract name)
    if type == "vrbind.strings":
        return await ctx.vr_eval("systemui", JS_STRINGS, timeout=5)

    app = args["app"]
    pages = ctx.vr_pages()
    if "controllerbindingui" not in pages or "systemui" not in pages:
        return {"ok": False, "error": "steamvr-pages-missing", "pages": pages}
    before = await _frame(ctx)
    if not before:
        return {"ok": False, "error": "no-dashboard-frame"}
    r = await ctx.vr_eval("controllerbindingui", JS_DEEPLINK % json.dumps(app), timeout=5)
    if r != "ok":
        return {"ok": False, "error": r}
    # SteamVR shows the overlay itself (ShowOverlayInDashboard); switch only if it did not
    after = before
    for _ in range(6):
        await asyncio.sleep(0.25)
        after = await _frame(ctx) or after
        if after.get("active") == after.get("bindPage"):
            break
    switched = False
    if after.get("active") != after.get("bindPage"):
        switched = bool(await ctx.vr_eval("systemui", JS_SWITCH % (json.dumps(after["frameID"]), json.dumps(after["bindPage"])), timeout=5))
        after = await _frame(ctx) or after
    ctx.state["deep"] = {
        "app": app, "frameID": before["frameID"], "back": before["active"],
        "bindPage": before["bindPage"], "at": time.time(), "seenList": False,
    }
    ctx.log(f"vrbind: deep link {app}: page {before['active']} -> {after.get('active')} (switched by us: {switched})")
    return {"ok": True, "app": app, "from": before["active"], "to": after.get("active"), "switched": switched}


async def tick(ctx):
    d = ctx.state.get("deep")
    if not d:
        return
    if time.time() - d["at"] > DEEP_TTL_S:
        ctx.state.pop("deep", None)
        ctx.log("vrbind: deep link expired")
        return
    f = await _frame(ctx)
    if not f or f.get("frameID") != d["frameID"]:
        return
    if f.get("active") != d["bindPage"]:
        # the user went elsewhere (another page, Steam's own path): forget, switch nothing
        if time.time() - d["at"] > 3:
            ctx.state.pop("deep", None)
            ctx.log("vrbind: binding page left by other means; deep link forgotten")
        return
    try:
        ui = await ctx.vr_eval("controllerbindingui", JS_UISTATE, timeout=3)
    except Exception:  # noqa: BLE001
        return
    if not ui or ui.get("loading"):
        return
    if ui.get("state") != APP_SELECT:
        d["seenList"] = True
        return
    if d["seenList"]:
        # Back from this app's list to the app list: return to Steam's page (GQ11d)
        await ctx.vr_eval("systemui", JS_SWITCH % (json.dumps(d["frameID"]), json.dumps(d["back"])), timeout=5)
        ctx.state.pop("deep", None)
        ctx.log(f"vrbind: back to page {d['back']}")


async def stop(ctx):
    ctx.state.pop("deep", None)
