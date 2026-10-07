#!/usr/bin/env python3
"""Phase-2 spatial capability probes (docs/phase2/capabilities/spatial.md).
Run ON the Frame, after copying this file and p2s_sg.js to one folder there:

  python3 p2s_probe.py e1|e2|e3|e4|e5|e5b|e6|e7|e8|e9|e10|e11|e12|e13|e14|e15|cleanup

  e1   interactive crops of Steam's main window: registered as laser targets?
  e2   Steam-side pooled popup used as an ornament (offset, depth, scale, yaw)
  e3   tint-anim over time, and push rates 30/60/90 Hz (payload, gaps)
  e4   window dim (tint), fade (opacity) and push-back (z) on the frame page
  e5   frame componentProps height (no effect)   e5b  frame-node height override
  e6   Steam main window with every background transparent (Home-view feel)
  e7   tint-anim timeline (30 captures)           e8   compositor CPU per push rate
  e15  moved header crop + several crops of one region, left of the window
  e16  SteamVR frame controls enlarged by CSS: quad and laser target grow
  cleanup  remove anything a crashed run left behind

Rules: every experiment holds /tmp/lgs/lab-vr.lock (plus lab.lock when it
touches Steam), restores what it changed in a finally block, and retires the
scene-graph ids it created (p2s_sg.js clear()). Headset-view captures (hvgrab)
go to /tmp/lgs/p2s/*.png. They show the room: look at them, then delete them.
Main-window crops only render while the Steam page of the dashboard frame is
shown (not Now Playing or SteamVR Settings), and only where the headset's
current view can see them.
"""
import asyncio
import fcntl
import json
import os
import subprocess
import sys
import time

GS = os.path.expanduser("~/.local/share/glass-shell")
sys.path.insert(0, os.path.join(GS, "device"))
import lgs  # noqa: E402
import lgs_vr  # noqa: E402

HERE = os.path.dirname(os.path.abspath(__file__))
HV = os.path.expanduser("~/glass-shell-native/native/spike/hvgrab")
OUT = "/tmp/lgs/p2s"
MAIN = "valve.steam.gamepadui.main"
RESULTS = {}


def log(k, v):
    RESULTS[k] = v
    s = v if isinstance(v, str) else json.dumps(v)
    print(f"[{k}] {s[:3000]}", flush=True)


class Lock:
    def __init__(self, path):
        self.path = path

    def __enter__(self):
        self.f = open(self.path, "w")
        t = time.time() + 240
        while True:
            try:
                fcntl.flock(self.f, fcntl.LOCK_EX | fcntl.LOCK_NB)
                return self
            except BlockingIOError:
                if time.time() > t:
                    raise SystemExit("lock busy: " + self.path)
                time.sleep(0.25)

    def __exit__(self, *a):
        fcntl.flock(self.f, fcntl.LOCK_UN)
        self.f.close()


def grab(tag):
    p = f"{OUT}/{tag}.png"
    r = subprocess.run([HV, p, "2"], capture_output=True, text=True)
    print(f"grab {tag}: rc={r.returncode}", flush=True)
    return p


def sysui_url():
    return next(t for t in lgs_vr.targets() if t["title"] == "systemui")["webSocketDebuggerUrl"]


def steam_url():
    return lgs.find_target("SharedJSContext")["webSocketDebuggerUrl"]


LASER = "(async()=>JSON.stringify(await window.OverlayStore.DumpLaserOverlays()))()"
FOCUS = ("(async()=>{let g=[];const h=VRHTML.RegisterForInputFocusDebugInfo(e=>g.push(e));"
         "await new Promise(r=>setTimeout(r,700));h.unregister();const e=g[g.length-1];"
         "return JSON.stringify(e?{top:e.computed.m_entryAtTopOfStack.m_unPanelSGID,stack:e.inputs.m_focusStack.map(x=>x.m_unPanelSGID),mode:e.computed.m_eSystemPanelInteractionMode}:null)})()")
SG_SRC = open(os.path.join(HERE, "p2s_sg.js"), encoding="utf-8").read().strip().rstrip(";")


def laser_summary(raw, want=None):
    d = json.loads(raw)
    out = {"targets": [], "skipped": [x for x in d.get("skippingDueToNonInteractivity", []) if (not want or want(x))]}
    for k, v in d.get("overlays", {}).items():
        sp = v.get("scene_graph_panel", {})
        lo = v.get("laser_overlay", {})
        if want and not want(k):
            continue
        out["targets"].append({"k": k, "key": lo.get("overlayHandle_key"), "src": sp.get("ulSourceOverlay"),
                               "interactive": sp.get("bInteractive"), "vis": sp.get("eVisibility"),
                               "w": round(sp.get("fWidth", 0), 4), "h": round(sp.get("fHeight", 0), 4),
                               "kbd": lo.get("bCanTakeKeyboardFocus"), "appid": lo.get("unSteamInputAppID"),
                               "sgid": sp.get("unSGID"), "ignoreAlpha": sp.get("bIgnoreTextureAlpha")})
    return out


def is_p2s(x):
    return "p2s" in x or "valve.steam.gamepadui.main" in x


async def e1():
    """Interactive crops of Steam's main window: popped in place, moved, plus an
    invisible-but-intersectable blocker. Are they laser targets of Steam's overlay?"""
    async with lgs.Session(sysui_url()) as s:
        hdr = await s.eval("(()=>{const f=FrameStore.frames[0];return JSON.stringify({H:f.size.mainPanelHeightOverride, dash:DashboardStore.dashboardScale})})()")
        log("e1.frame", hdr)
        H = json.loads(hdr)["H"] or 1.5
        M = H / 1080.0
        common = {"key": MAIN, "meters-per-pixel": M, "curvature": "inherit-from-parent-panel",
                  "interactive": True, "steam-input-appid": 769, "can-take-keyboard-focus": True}
        items = [
            {"name": "pop", "parentKey": MAIN, "at": [0.225, 0.0375], "xf": "0 0 0.03",
             "panel": dict(common, uv_min=[0, 0], uv_max=[0.45, 0.075])},
            {"name": "moved", "parentKey": MAIN, "at": [0.0, 0.35], "xf": "-0.25 0 0.04",
             "wrap": [{"type": "tint", "props": {"color": [0.55, 1, 0.55]}}],
             "panel": dict(common, uv_min=[0, 0.1], uv_max=[0.04, 0.6])},
            {"name": "blocker", "parentKey": MAIN, "at": [0.02, 0.35], "xf": "0 0 0.001",
             "panel": {"key": "system.systemui", "uv_min": [0.95, 0.95], "uv_max": [0.99, 0.99],
                       "width": 0.04 * 1920 * M, "interactive": True, "visibility": 3,
                       "can-take-keyboard-focus": False}},
        ]
        log("e1.focus_before", await s.eval(FOCUS))
        log("e1.laser_before", laser_summary(await s.eval(LASER), is_p2s))
        try:
            log("e1.inject", await s.eval(f"({SG_SRC})({json.dumps({'items': items, 'ttlMs': 40000})})"))
            await asyncio.sleep(1.2)
            log("e1.laser_with", laser_summary(await s.eval(LASER), is_p2s))
            log("e1.focus_with", await s.eval(FOCUS))
            grab("e1_crops")
        finally:
            log("e1.clear", await s.eval("window.__P2S?window.__P2S.clear():'none'"))
        await asyncio.sleep(0.8)
        log("e1.laser_after", laser_summary(await s.eval(LASER), is_p2s))
        log("e1.focus_after", await s.eval(FOCUS))


POP_OPEN = r"""
(async()=>{
 const s=window.vrPooledPopupStore; const sleep=ms=>new Promise(r=>setTimeout(r,ms));
 const hosts=()=>Object.fromEntries(Object.entries(s.m_mapHostWindowsForType).map(([t,a])=>[t,a.map(h=>h.overlayKey+(h.isShowingPopup?'*':''))]));
 const before=hosts();
 const type=__TYPE__;
 const params=__PARAMS__;
 const id=s.CreatePooledPopup(type, params, st=>{ (window.__P2S_POPLOG=window.__P2S_POPLOG||[]).push(st); });
 let inst; for(let i=0;i<150;i++){inst=s.m_mapPooledPopupInstances.get(id); if(inst&&inst.contentElement) break; await sleep(30);}
 if(!inst||!inst.contentElement){ s.ClosePooledPopup(id).catch(()=>{}); return JSON.stringify({error:'no content element', state: inst&&inst.state}); }
 const doc=inst.contentElement.ownerDocument;
 const d=doc.createElement('div'); d.id='p2s-ornament';
 d.style.cssText='width:80px;height:360px;border-radius:40px;background:rgba(235,240,250,.38);box-shadow:inset 0 0 0 1.5px rgba(255,255,255,.55);display:flex;flex-direction:column;align-items:center;justify-content:space-evenly;';
 for(let i=0;i<5;i++){const c=doc.createElement('div');c.style.cssText='width:56px;height:56px;border-radius:28px;background:'+(i==0?'#fff':'rgba(255,255,255,.2)')+';color:'+(i==0?'#000':'#fff')+';font:600 24px sans-serif;display:flex;align-items:center;justify-content:center';c.textContent='ABCDE'[i];d.appendChild(c);}
 inst.contentElement.appendChild(d);
 for(let i=0;i<150&&inst.state!=2;i++) await sleep(30);
 window.__P2S_POP={id, t:setTimeout(()=>{s.ClosePooledPopup(id).catch(()=>{});},60000)};
 return JSON.stringify({id,state:inst.state,host:inst.hostWindow&&inst.hostWindow.overlayKey,params:inst.latestParams,before,after:hosts()});
})()
"""
POP_UPDATE = r"""
(async()=>{const s=window.vrPooledPopupStore;const inst=s.m_mapPooledPopupInstances.get(window.__P2S_POP.id);
 const p=Object.assign({},inst.latestParams,__PATCH__);
 await s.SendPendingInstanceParamsToSteamVR(inst,p).catch(e=>String(e));
 return JSON.stringify(inst.latestParams);})()
"""
POP_CLOSE = r"""
(async()=>{const s=window.vrPooledPopupStore; const P=window.__P2S_POP; if(!P) return 'none';
 clearTimeout(P.t); await s.ClosePooledPopup(P.id).catch(()=>{}); delete window.__P2S_POP;
 await new Promise(r=>setTimeout(r,400));
 return JSON.stringify(Object.fromEntries(Object.entries(s.m_mapHostWindowsForType).map(([t,a])=>[t,a.map(h=>h.overlayKey+(h.isShowingPopup?'*':''))])));})()
"""
POP_NODE = r"""
(()=>{const out=[];for(const el of document.querySelectorAll('[id^=PooledPopup]')){let n;try{n=el.buildNode({},el)[1].properties}catch(e){continue}
 if(!/barpopup|frame\.menu/.test(n.key||'')) continue;
 const chain=[];let p=el.parentElement;for(let i=0;i<5&&p;i++,p=p.parentElement){if(p.tagName==='VSG-TRANSFORM')chain.push(p.getAttribute('translation')+' | rot '+p.getAttribute('rotation'));else if(p.getAttribute('vsg-type')){let x='';try{const r=p.buildNode&&p.buildNode({},p);x=r&&r[1]?' '+JSON.stringify(r[1].properties):''}catch(e){};chain.push(p.getAttribute('vsg-type')+x);}}
 out.push({key:n.key,uv:[n.uv_min,n.uv_max],mpp:n['meters-per-pixel'],interactive:n.interactive,appid:n['steam-input-appid'],chain});}
 return JSON.stringify(out);})()
"""


async def e2():
    """Steam-side pooled popup as an ornament: parented to the main window's
    leading edge, pushed forward, then larger and toed in. Uses an idle
    barpopup host (type 1), so no new window is spawned."""
    params = {"parent_overlay_key": MAIN, "origin_on_parent": {"x": -1, "y": 0}, "origin_on_popup": {"x": 1, "y": 0},
              "offset": {"x_pixels": -24, "y_pixels": 0, "z_pixels": 40}, "interactive": True,
              "inherit_parent_curvature": True}
    async with lgs.Session(steam_url()) as st, lgs.Session(sysui_url()) as s:
        try:
            r = await st.eval(POP_OPEN.replace("__TYPE__", "1").replace("__PARAMS__", json.dumps(params)), 30)
            log("e2.open", r)
            await asyncio.sleep(1.0)
            log("e2.node", await s.eval(POP_NODE))
            log("e2.laser", laser_summary(await s.eval(LASER), lambda k: "barpopup" in k))
            grab("e2a_ornament")
            r = await st.eval(POP_UPDATE.replace("__PATCH__", json.dumps({"offset": {"x_pixels": -36, "y_pixels": 0, "z_pixels": 160},
                                                                           "scale": {"scaler_value": 1.5},
                                                                           "rotation": {"pitch_degrees": 0, "yaw_degrees": 20}})), 20)
            log("e2.update", r)
            await asyncio.sleep(1.0)
            log("e2.node2", await s.eval(POP_NODE))
            log("e2.laser2", laser_summary(await s.eval(LASER), lambda k: "barpopup" in k))
            grab("e2b_forward_big_yaw")
        finally:
            log("e2.close", await st.eval(POP_CLOSE, 20))
        await asyncio.sleep(0.6)
        log("e2.node_after", await s.eval(POP_NODE))


TINT_ANIM = [
    {"name": "tanim", "parentKey": MAIN, "at": [0.5, 0.5], "xf": "0 0 0.1",
     "wrap": [{"type": "tint-anim", "props": {"color": [1, 1, 1, 0.15, 0.15, 0.15], "animation-seconds": 4}}],
     "panel": {"key": MAIN, "uv_min": [0.3, 0.3], "uv_max": [0.7, 0.7], "meters-per-pixel": 1.5 / 1080,
               "curvature": "inherit-from-parent-panel", "interactive": False}},
    {"name": "tref", "parentKey": MAIN, "at": [0.15, 0.5], "xf": "0 0 0.1",
     "panel": {"key": MAIN, "uv_min": [0.05, 0.3], "uv_max": [0.25, 0.7], "meters-per-pixel": 1.5 / 1080,
               "curvature": "inherit-from-parent-panel", "interactive": False}},
]

PUSH_RATE = r"""
(async()=>{
 const sends=[]; const orig=WebSocket.prototype.send;
 WebSocket.prototype.send=function(d){ try{ if(typeof d==='string' && d.indexOf('update_scene_graph')>=0) sends.push([performance.now(), d.length]); }catch(e){} return orig.apply(this, arguments); };
 const t0=performance.now(); let busy=0;
 try{
  for(let i=0;i<__N__;i++){
   const a=performance.now();
   window.__P2S.setXf('tref', '0 0 '+(0.1+0.03*Math.sin(i/6)).toFixed(4));
   busy+=performance.now()-a;
   await new Promise(r=>setTimeout(r, __MS__));
  }
  await new Promise(r=>setTimeout(r,100));
 } finally { WebSocket.prototype.send=orig; }
 const dt=sends.slice(1).map((s,i)=>s[0]-sends[i][0]);
 return JSON.stringify({n:sends.length, seconds:(performance.now()-t0)/1000, bytes:sends.length?sends[0][1]:0,
   meanGapMs: dt.length? dt.reduce((a,b)=>a+b,0)/dt.length:0, maxGapMs: Math.max(0,...dt), callMs: busy/__N__});
})()
"""


async def e3():
    """Animation: (a) does a tint-anim node fade by itself? (b) how fast can we
    push transform changes (payload size, achieved rate)."""
    async with lgs.Session(sysui_url()) as s:
        try:
            log("e3.inject", await s.eval(f"({SG_SRC})({json.dumps({'items': TINT_ANIM, 'ttlMs': 40000})})"))
            t0 = time.time()
            for tag, at in (("e3_t0.3", 0.3), ("e3_t1.5", 1.5), ("e3_t3", 3.0), ("e3_t5", 5.0)):
                while time.time() - t0 < at:
                    await asyncio.sleep(0.02)
                grab(tag)
            for hz in (30, 60, 90):
                ms = int(1000 / hz)
                r = await s.eval(PUSH_RATE.replace("__N__", str(hz * 2)).replace("__MS__", str(ms)), 30)
                log(f"e3.push{hz}", r)
        finally:
            log("e3.clear", await s.eval("window.__P2S?window.__P2S.clear():'none'"))


FRAME_XF = r"""
(()=>{const mt=[...document.querySelectorAll('vsg-node[vsg-type=mountedscenegraph]')].find(e=>{try{return /frame:\d+:page:3:mountable/.test(e.buildNode({},e)[1].properties.mountable_id)}catch(x){return false}});
 if(!mt) return null; const t1=mt.parentElement, t2=t1.parentElement, t3=t2.parentElement;
 window.__P2S_FX={mt,t1,t2,t3,orig:{t1:t1.getAttribute('translation'),t2:t2.getAttribute('translation'),t1b:t1.buildNode,t2s:t2.getAttribute('scale')}};
 return JSON.stringify({t1:[t1.tagName,t1.getAttribute('translation'),t1.getAttribute('scale')],t2:[t2.tagName,t2.getAttribute('translation'),t2.getAttribute('scale')],t3:[t3.tagName,t3.getAttribute('translation'),t3.getAttribute('scale'),t3.getAttribute('parent-id')]});})()
"""
PUSHER = ("(()=>{let req;window.webpackChunkvrwebui.push([[Symbol('p2s')],{},r=>{req=r}]);const ex=req('5723');"
          "for(const k of Object.keys(ex)){try{if(String(ex[k]).indexOf('update_scene_graph')>=0){ex[k]();return 'pushed'}}catch(e){}}return 'no pusher'})()")
FX_TINT = ("(()=>{const F=window.__P2S_FX;F.t1.buildNode=(ctx,t)=>[ctx,{type:'__T__',properties:Object.assign({sgid:Number(F.t1.getAttribute('sgid'))},__P__)}];"
           "return 'ok'})()")
FX_RESTORE = ("(()=>{const F=window.__P2S_FX;if(!F)return 'none';if(F.orig.t1b)F.t1.buildNode=F.orig.t1b;else delete F.t1.buildNode;"
              "F.t1.setAttribute('translation',F.orig.t1);F.t2.setAttribute('translation',F.orig.t2);delete window.__P2S_FX;return 'restored'})()")


async def e4():
    """Window dim / push-back: put a tint, then an opacity node in place of the
    identity transform that wraps the Steam frame page; then push the page back
    in z. Restores the transform's own serialization afterwards."""
    async with lgs.Session(sysui_url()) as s:
        log("e4.chain", await s.eval(FRAME_XF))
        try:
            grab("e4_0_before")
            log("e4.tint", await s.eval(FX_TINT.replace("__T__", "tint").replace("__P__", json.dumps({"color": [0.4, 0.4, 0.4]}))))
            log("e4.push", await s.eval(PUSHER))
            await asyncio.sleep(0.8)
            grab("e4_1_tint40")
            log("e4.opacity", await s.eval(FX_TINT.replace("__T__", "opacity").replace("__P__", json.dumps({"opacity": 0.45}))))
            log("e4.push", await s.eval(PUSHER))
            await asyncio.sleep(0.8)
            grab("e4_2_opacity45")
            log("e4.restore1", await s.eval("(()=>{const F=window.__P2S_FX;if(F.orig.t1b)F.t1.buildNode=F.orig.t1b;else delete F.t1.buildNode;return 'ok'})()"))
            log("e4.pushback", await s.eval("(()=>{const F=window.__P2S_FX;F.t1.setAttribute('translation','0 0 -0.3');return F.t1.getAttribute('translation')})()"))
            log("e4.push", await s.eval(PUSHER))
            await asyncio.sleep(0.8)
            log("e4.laser_pushed", laser_summary(await s.eval(LASER), lambda k: "gamepadui.main" in k))
            grab("e4_3_pushback")
        finally:
            log("e4.restore", await s.eval(FX_RESTORE))
            log("e4.push", await s.eval(PUSHER))
        await asyncio.sleep(0.8)
        grab("e4_4_restored")


async def e5():
    """Window size: raise the frame's in-memory forcedUniformDashboardHeight
    (1.5 units) to 1.8 and back. Is the main panel larger, still a laser target?"""
    async with lgs.Session(sysui_url()) as s:
        log("e5.before", await s.eval("JSON.stringify({p:FrameStore.frames[0].size.componentProps, o:FrameStore.frames[0].size.mainPanelHeightOverride})"))
        try:
            grab("e5_0_before")
            log("e5.set", await s.eval("(()=>{const f=FrameStore.frames[0];window.__P2S_H=f.size.componentProps.forcedUniformDashboardHeight;"
                                       "f.size.componentProps.forcedUniformDashboardHeight=1.8;return JSON.stringify({o:f.size.mainPanelHeightOverride})})()"))
            await asyncio.sleep(1.2)
            log("e5.frame_node", await s.eval("(()=>{const n=[...document.querySelectorAll('vsg-node[vsg-type=frame-node]')][0];return JSON.stringify(n.buildNode({},n)[1].properties['override-pre-resize-main-panel-height'])})()"))
            log("e5.laser", laser_summary(await s.eval(LASER), lambda k: "gamepadui.main" in k))
            grab("e5_1_h18")
        finally:
            log("e5.restore", await s.eval("(()=>{const f=FrameStore.frames[0];if(window.__P2S_H!==undefined){f.size.componentProps.forcedUniformDashboardHeight=window.__P2S_H;delete window.__P2S_H;}return JSON.stringify({o:f.size.mainPanelHeightOverride})})()"))
        await asyncio.sleep(1.2)
        log("e5.laser_after", laser_summary(await s.eval(LASER), lambda k: "gamepadui.main" in k))
        grab("e5_2_restored")


CLEAR_STYLE = r"""
(()=>{const w=L.surface('main');const d=w.document;let st=d.getElementById('p2s-transparent');
 if(__ON__){ if(!st){st=d.createElement('style');st.id='p2s-transparent';d.head.appendChild(st);}
   st.textContent='html, body, body *:not(img):not(video):not(canvas) { background-color: transparent !important; backdrop-filter: none !important; box-shadow: none !important; } body *::before, body *::after { background-color: transparent !important; backdrop-filter: none !important; }';
   return 'on'; }
 if(st) st.remove(); return 'off';})()
"""


async def e6():
    """Home-view idea: Steam's main window with every background transparent,
    so content floats over the room (captured, then removed)."""
    js_on = CLEAR_STYLE.replace("__ON__", "true")
    js_off = CLEAR_STYLE.replace("__ON__", "false")
    helpers = open(os.path.join(GS, "device", "lgs_index.js"), encoding="utf-8").read() + "\n" + \
        open(os.path.join(GS, "lab", "lab_helpers.js"), encoding="utf-8").read()
    wrap = lambda e: f"(async () => {{ {helpers}\nconst L = window.__LGS_LAB;\nreturn await ({e}); }})()"  # noqa: E731
    async with lgs.Session(steam_url()) as st:
        try:
            grab("e6_0_before")
            log("e6.on", await st.eval(wrap(js_on)))
            await asyncio.sleep(1.0)
            grab("e6_1_transparent")
        finally:
            log("e6.off", await st.eval(wrap(js_off)))


def e7_items():
    M = 1.5 / 1080
    base = {"key": MAIN, "meters-per-pixel": M, "interactive": False, "curvature": "inherit-from-parent-panel"}
    uv = {"uv_min": [0.0, 0.0], "uv_max": [0.2, 0.2]}
    return [
        {"name": "anim", "parentKey": MAIN, "at": [0.5, 1.0], "xf": "-0.6 -0.8 0.05",
         "wrap": [{"type": "tint-anim", "props": {"color": [1, 1, 1, 0.1, 0.1, 0.1], "animation-seconds": 4}}],
         "panel": dict(base, **uv)},
        {"name": "ref", "parentKey": MAIN, "at": [0.5, 1.0], "xf": "0.6 -0.8 0.05", "panel": dict(base, **uv)},
    ]


async def e7():
    """tint-anim timeline (two floating copies of the same crop, one animated)
    and translation units (markers at +-1.0 unit from the window centre)."""
    async with lgs.Session(sysui_url()) as s:
        try:
            log("e7.inject", await s.eval(f"({SG_SRC})({json.dumps({'items': e7_items(), 'ttlMs': 40000})})"))
            t0 = time.time()
            stamps = []
            for i in range(30):
                while time.time() - t0 < 0.3 * i:
                    await asyncio.sleep(0.01)
                ts = time.time() - t0
                grab(f"e7_{i:02d}")
                stamps.append([i, round(ts, 3), round(time.time() - t0, 3)])
            log("e7.stamps", stamps)
        finally:
            log("e7.clear", await s.eval("window.__P2S?window.__P2S.clear():'none'"))


FN_WRAP = r"""
(()=>{const n=[...document.querySelectorAll('vsg-node[vsg-type=frame-node]')].find(e=>{try{return e.buildNode({},e)[1].properties['frame-id']===FrameStore.frames[0].frameID}catch(x){return false}});
 if(!n) return 'no frame node'; if(window.__P2S_FN) return 'already';
 const orig=n.buildNode; window.__P2S_FN={n,orig};
 n.buildNode=(c,t)=>{const r=orig(c,t); if(r&&r[1]) r[1].properties['override-pre-resize-main-panel-height']=__H__; return r;};
 return JSON.stringify(n.buildNode({},n)[1].properties);})()
"""
FN_RESTORE = "(()=>{const F=window.__P2S_FN;if(!F)return 'none';F.n.buildNode=F.orig;delete window.__P2S_FN;return 'restored'})()"


async def e5b():
    """Window size via the frame-node's override-pre-resize-main-panel-height
    (1.5 units by default): wrap the frame-node's buildNode to send 1.8."""
    async with lgs.Session(sysui_url()) as s:
        try:
            grab("e5b_0_before")
            log("e5b.wrap", await s.eval(FN_WRAP.replace("__H__", "1.8")))
            log("e5b.push", await s.eval(PUSHER))
            await asyncio.sleep(1.2)
            log("e5b.laser", laser_summary(await s.eval(LASER), lambda k: "gamepadui.main" in k or "frame-controls" in k))
            grab("e5b_1_h18")
        finally:
            log("e5b.restore", await s.eval(FN_RESTORE))
            log("e5b.push", await s.eval(PUSHER))
        await asyncio.sleep(1.2)
        log("e5b.laser_after", laser_summary(await s.eval(LASER), lambda k: "gamepadui.main" in k))
        grab("e5b_2_restored")


def cpu_ticks(pid):
    with open(f"/proc/{pid}/stat") as f:
        parts = f.read().rsplit(")", 1)[1].split()
    return int(parts[11]) + int(parts[12])


def pids(name):
    out = subprocess.run(["pgrep", "-f", name], capture_output=True, text=True).stdout.split()
    return [int(x) for x in out]


STORM = r"""
(async()=>{const t0=performance.now();let i=0;while(performance.now()-t0<__SEC__*1000){window.__P2S.setXf('mover','0 0 '+(0.05+0.03*Math.sin(i/8)).toFixed(4));i++;await new Promise(r=>setTimeout(r,__MS__));}return i})()
"""


async def e8():
    """Cost of animating by pushing: vrcompositor CPU while a crop's z is
    re-pushed at 0 / 30 / 60 / 90 Hz for 4 s each."""
    comp = pids("/opt/steamvr/bin/linuxarm64/vrcompositor")[0]
    items = [{"name": "mover", "parentKey": MAIN, "at": [0.5, 0.5], "xf": "0 0 0.05",
              "panel": {"key": MAIN, "uv_min": [0.4, 0.4], "uv_max": [0.6, 0.6], "meters-per-pixel": 1.5 / 1080,
                        "curvature": "inherit-from-parent-panel", "interactive": False}}]
    hz_tick = os.sysconf("SC_CLK_TCK")
    async with lgs.Session(sysui_url()) as s:
        try:
            log("e8.inject", await s.eval(f"({SG_SRC})({json.dumps({'items': items, 'ttlMs': 60000})})"))
            res = {}
            for hz in (0, 30, 60, 90):
                a = cpu_ticks(comp)
                t = time.time()
                if hz:
                    n = await s.eval(STORM.replace("__SEC__", "4").replace("__MS__", str(int(1000 / hz))), 30)
                else:
                    await asyncio.sleep(4)
                    n = 0
                dt = time.time() - t
                res[hz] = {"pushes": n, "cpu_pct": round(100 * (cpu_ticks(comp) - a) / hz_tick / dt, 1)}
            log("e8.cpu", res)
        finally:
            log("e8.clear", await s.eval("window.__P2S?window.__P2S.clear():'none'"))


async def e9():
    """Which of several crops of the same overlay render? A/B identical uv
    (red/green tint), C uv nudged (blue tint), D unwrapped, E interactive."""
    M = 1.5 / 1080
    uv = [0.35, 0.25, 0.65, 0.55]
    def it(name, x, y, tint=None, nudge=0.0, extra=None):
        d = {"name": name, "parentKey": MAIN, "at": [0.5, 1.0], "xf": f"{x} {y} 0.05",
             "panel": dict({"key": MAIN, "uv_min": [uv[0] + nudge, uv[1]], "uv_max": [uv[2] + nudge, uv[3]],
                            "meters-per-pixel": M, "curvature": "inherit-from-parent-panel", "interactive": False}, **(extra or {}))}
        if tint:
            d["wrap"] = [{"type": "tint", "props": {"color": tint}}]
        return d
    items = [it("A", -0.9, -0.55, [1, 0.3, 0.3]), it("B", 0.0, -0.55, [0.3, 1, 0.3]),
             it("C", 0.9, -0.55, [0.3, 0.3, 1], nudge=0.001), it("D", -0.45, -1.05, None, nudge=0.002),
             it("E", 0.45, -1.05, None, nudge=0.003, extra={"interactive": True, "steam-input-appid": 769})]
    async with lgs.Session(sysui_url()) as s:
        try:
            log("e9.inject", await s.eval(f"({SG_SRC})({json.dumps({'items': items, 'ttlMs': 40000})})"))
            await asyncio.sleep(1.5)
            grab("e9_crops")
        finally:
            log("e9.clear", await s.eval("window.__P2S?window.__P2S.clear():'none'"))


async def e10():
    """Moved interactive crop with visible content (header strip lifted above
    the window, green tint) plus five crops of one region below the window."""
    M = 1.5 / 1080
    uv = [0.35, 0.25, 0.65, 0.55]
    def it(name, x, y, tint=None, nudge=0.0, extra=None):
        d = {"name": name, "parentKey": MAIN, "at": [0.5, 1.0], "xf": f"{x} {y} 0.05",
             "panel": dict({"key": MAIN, "uv_min": [uv[0] + nudge, uv[1]], "uv_max": [uv[2] + nudge, uv[3]],
                            "meters-per-pixel": M, "curvature": "inherit-from-parent-panel", "interactive": False}, **(extra or {}))}
        if tint:
            d["wrap"] = [{"type": "tint", "props": {"color": tint}}]
        return d
    items = [{"name": "search_up", "parentKey": MAIN, "at": [0.225, 0.0375], "xf": "0 0.3 0.04",
              "wrap": [{"type": "tint", "props": {"color": [0.5, 1, 0.5]}}],
              "panel": {"key": MAIN, "uv_min": [0, 0], "uv_max": [0.45, 0.075], "meters-per-pixel": M,
                        "curvature": "inherit-from-parent-panel", "interactive": True, "steam-input-appid": 769}},
             it("A", -0.9, -0.55, [1, 0.3, 0.3]), it("B", 0.0, -0.55, [0.3, 1, 0.3]),
             it("C", 0.9, -0.55, [0.3, 0.3, 1], nudge=0.001), it("D", -0.45, -1.05, None, nudge=0.002),
             it("E", 0.45, -1.05, None, nudge=0.003, extra={"interactive": True, "steam-input-appid": 769})]
    async with lgs.Session(sysui_url()) as s:
        for _ in range(60):
            d = json.loads(await s.eval(LASER))
            if any("gamepadui.main_sgid" in k for k in d.get("overlays", {})):
                break
            await asyncio.sleep(1)
        log("e10.active", await s.eval("String(DashboardStore.activeFrame&&DashboardStore.activeFrame.frameID)+' '+FrameStore.frames[0].activePage.mountableID"))
        try:
            log("e10.inject", await s.eval(f"({SG_SRC})({json.dumps({'items': items, 'ttlMs': 40000})})"))
            await asyncio.sleep(1.5)
            log("e10.laser", laser_summary(await s.eval(LASER), lambda k: "p2s" in k))
            grab("e10_crops")
        finally:
            log("e10.clear", await s.eval("window.__P2S?window.__P2S.clear():'none'"))


async def e11():
    """Bisect the invisible crops: (1) one crop below the window, (2) the same
    plus a lifted header crop under the same reparent-to-panel, (3) same as 2
    without curvature inheritance."""
    M = 1.5 / 1080
    def crop(name, at, xf, uv, curv=True, tint=None):
        d = {"name": name, "parentKey": MAIN, "at": at, "xf": xf,
             "panel": {"key": MAIN, "uv_min": uv[:2], "uv_max": uv[2:], "meters-per-pixel": M, "interactive": False}}
        if curv:
            d["panel"]["curvature"] = "inherit-from-parent-panel"
        if tint:
            d["wrap"] = [{"type": "tint", "props": {"color": tint}}]
        return d
    B = lambda c=True: crop("B", [0.5, 1.0], "0 -0.55 0.05", [0.35, 0.25, 0.65, 0.55], c)  # noqa: E731
    S = lambda c=True: crop("S", [0.225, 0.0375], "0 0.3 0.04", [0, 0, 0.45, 0.075], c, [0.5, 1, 0.5])  # noqa: E731
    variants = {"v1": [B()], "v2": [B(), S()], "v3": [B(False), S(False)]}
    async with lgs.Session(sysui_url()) as s:
        for name, items in variants.items():
            try:
                log(f"e11.{name}", await s.eval(f"({SG_SRC})({json.dumps({'items': items, 'ttlMs': 20000})})"))
                await asyncio.sleep(1.5)
                grab(f"e11_{name}")
            finally:
                log(f"e11.{name}.clear", await s.eval("window.__P2S?window.__P2S.clear():'none'"))
            await asyncio.sleep(0.8)


async def e12():
    """Is reparenting to main broken, or crops in general? (4) crop of main
    parented to the bar, (5) crop of the bar parented to the bar, (6) crop of
    main parented to main at the window centre, popped 0.1 forward."""
    M = 1.5 / 1080
    MB = 0.0015308333333333335
    BAR = "valve.steam.gamepadui.bar"
    variants = {
        "v4": [{"name": "mainOnBar", "parentKey": BAR, "at": [0.5, 0.5], "xf": "0 -0.35 0.05",
                "panel": {"key": MAIN, "uv_min": [0.35, 0.25], "uv_max": [0.65, 0.55], "meters-per-pixel": M, "interactive": False}}],
        "v5": [{"name": "barOnBar", "parentKey": BAR, "at": [0.5, 0.5], "xf": "0 -0.25 0.05",
                "panel": {"key": BAR, "uv_min": [0.3, 0], "uv_max": [0.7, 1], "meters-per-pixel": MB, "interactive": False}}],
        "v6": [{"name": "mainCentre", "parentKey": MAIN, "at": [0.5, 0.5], "xf": "0 0 0.1",
                "wrap": [{"type": "tint", "props": {"color": [1, 0.35, 0.35]}}],
                "panel": {"key": MAIN, "uv_min": [0.35, 0.25], "uv_max": [0.65, 0.55], "meters-per-pixel": M,
                          "curvature": "inherit-from-parent-panel", "interactive": False}}],
    }
    async with lgs.Session(sysui_url()) as s:
        for name, items in variants.items():
            try:
                log(f"e12.{name}", await s.eval(f"({SG_SRC})({json.dumps({'items': items, 'ttlMs': 20000})})"))
                await asyncio.sleep(1.5)
                grab(f"e12_{name}")
            finally:
                log(f"e12.{name}.clear", await s.eval("window.__P2S?window.__P2S.clear():'none'"))
            await asyncio.sleep(0.8)


async def e13():
    """Re-run of the E3 layout that rendered at 00:09 (two crops, separate
    groups not needed: single item each run)."""
    async with lgs.Session(sysui_url()) as s:
        for name, items in {"a": TINT_ANIM[:1], "b": [dict(TINT_ANIM[1], xf="0 0 0.1", at=[0.15, 0.5])]}.items():
            try:
                log(f"e13.{name}", await s.eval(f"({SG_SRC})({json.dumps({'items': items, 'ttlMs': 20000})})"))
                await asyncio.sleep(2.0)
                grab(f"e13_{name}")
            finally:
                log(f"e13.{name}.clear", await s.eval("window.__P2S?window.__P2S.clear():'none'"))
            await asyncio.sleep(0.5)


async def e14():
    """Obvious placement: a big crop of main beside the window's right edge."""
    M = 1.5 / 1080
    base = {"key": MAIN, "uv_min": [0.0, 0.0], "uv_max": [0.5, 0.5], "meters-per-pixel": M, "interactive": False}
    variants = {
        "plain": [{"name": "side", "parentKey": MAIN, "at": [1.0, 0.5], "xf": "1.0 0 0.05", "panel": dict(base)}],
        "tinted": [{"name": "side", "parentKey": MAIN, "at": [1.0, 0.5], "xf": "1.0 0 0.05", "panel": dict(base),
                    "wrap": [{"type": "tint", "props": {"color": [1, 0.4, 0.4]}}]}],
        "anim": [{"name": "side", "parentKey": MAIN, "at": [1.0, 0.5], "xf": "1.0 0 0.05", "panel": dict(base),
                  "wrap": [{"type": "tint-anim", "props": {"color": [1, 1, 1, 0.3, 0.3, 0.3], "animation-seconds": 4}}]}],
    }
    async with lgs.Session(sysui_url()) as s:
        for name, items in variants.items():
            try:
                log(f"e14.{name}", await s.eval(f"({SG_SRC})({json.dumps({'items': items, 'ttlMs': 20000})})"))
                await asyncio.sleep(1.5)
                grab(f"e14_{name}")
            finally:
                log(f"e14.{name}.clear", await s.eval("window.__P2S?window.__P2S.clear():'none'"))
            await asyncio.sleep(0.6)


async def e15():
    """All crops LEFT of the window (the camera's current view): a moved,
    interactive header strip (green) and three crops of one region (red, blue
    tinted with the same uv, one plain with a nudged uv), one reparent."""
    M = 1.5 / 1080
    uvB = [0.35, 0.25, 0.65, 0.55]
    def crop(name, xf, uv, tint=None, inter=False):
        d = {"name": name, "parentKey": MAIN, "at": [0.0, 0.5], "xf": xf,
             "panel": {"key": MAIN, "uv_min": uv[:2], "uv_max": uv[2:], "meters-per-pixel": M,
                       "curvature": "inherit-from-parent-panel", "interactive": inter}}
        if inter:
            d["panel"]["steam-input-appid"] = 769
        if tint:
            d["wrap"] = [{"type": "tint", "props": {"color": tint}}]
        return d
    items = [crop("L1", "-0.8 0.55 0.04", [0, 0, 0.45, 0.075], [0.5, 1, 0.5], True),
             crop("L2", "-0.8 0.1 0.04", uvB, [1, 0.4, 0.4]),
             crop("L3", "-0.8 -0.45 0.04", uvB, [0.4, 0.4, 1]),
             crop("L4", "-1.9 0 0.04", [uvB[0] + 0.002, uvB[1], uvB[2] + 0.002, uvB[3]])]
    async with lgs.Session(sysui_url()) as s:
        try:
            log("e15.inject", await s.eval(f"({SG_SRC})({json.dumps({'items': items, 'ttlMs': 30000})})"))
            await asyncio.sleep(1.5)
            log("e15.laser", laser_summary(await s.eval(LASER), lambda k: "p2s" in k))
            grab("e15_left")
        finally:
            log("e15.clear", await s.eval("window.__P2S?window.__P2S.clear():'none'"))


FC_CSS = r"""
(()=>{let st=document.getElementById('p2s-fc');
 if(__ON__){ if(!st){st=document.createElement('style');st.id='p2s-fc';document.head.appendChild(st);}
  st.textContent='[class*="FrameControlsContainer"] .ButtonControl{padding:18px 30px !important} [class*="FrameControlsContainer"] .ButtonControl svg.Icon{width:56px !important;height:56px !important}';
 } else if(st) st.remove();
 const el=document.querySelector('[class*="FrameControlsContainer"]'); const r=el&&el.getBoundingClientRect();
 return JSON.stringify(r?{w:r.width,h:r.height}:null);})()
"""


async def e16():
    """Enlarge SteamVR's frame controls with CSS inside systemui: does the quad
    grow, and does its laser target follow?"""
    async with lgs.Session(sysui_url()) as s:
        want = lambda k: "frame-controls" in k  # noqa: E731
        log("e16.before", {"dom": await s.eval(FC_CSS.replace("__ON__", "false")), "laser": laser_summary(await s.eval(LASER), want)})
        try:
            grab("e16_0_before")
            log("e16.on", await s.eval(FC_CSS.replace("__ON__", "true")))
            await asyncio.sleep(1.5)
            log("e16.laser_on", laser_summary(await s.eval(LASER), want))
            grab("e16_1_big")
        finally:
            log("e16.off", await s.eval(FC_CSS.replace("__ON__", "false")))
        await asyncio.sleep(1.5)
        log("e16.laser_after", laser_summary(await s.eval(LASER), want))


async def cleanup():
    async with lgs.Session(sysui_url()) as s:
        log("cleanup.sg", await s.eval("window.__P2S?window.__P2S.clear():'none'"))
        log("cleanup.fx", await s.eval(FX_RESTORE))
        log("cleanup.fn", await s.eval(FN_RESTORE))
        log("cleanup.fc", await s.eval(FC_CSS.replace("__ON__", "false")))
    async with lgs.Session(steam_url()) as st:
        log("cleanup.pop", await st.eval(POP_CLOSE, 20))


def main():
    os.makedirs(OUT, exist_ok=True)
    cmd = sys.argv[1]
    steam_too = cmd in ("e2", "e6", "cleanup")
    with Lock("/tmp/lgs/lab-vr.lock"):
        if steam_too:
            with Lock("/tmp/lgs/lab.lock"):
                asyncio.run(globals()[cmd]())
        else:
            asyncio.run(globals()[cmd]())
    with open(f"{OUT}/{cmd}.json", "w") as f:
        json.dump(RESULTS, f, indent=1)


if __name__ == "__main__":
    main()
