#!/usr/bin/env python3
"""Fetch the Frame's real launcher data for the home-apps mockups (read-only).

  python docs/phase2/mockups/fetch-library-refs.py            # fetch from the Frame, then write library.js
  python docs/phase2/mockups/fetch-library-refs.py --no-fetch # only rebuild library.js from what is on disk

Writes to docs/refs/library/ (git-ignored, like docs/refs/visionos/):
  art/<appid>_{hero.jpg,logo.png,port.jpg,header.jpg}   downscaled copies of Steam's local library cache
  icons/<slug>.png                                      the 64 px strIconDataBase64 of each "+" program, unchanged
  library.js                                            window.LGS_LIB = {...} for the mockups

Why not commit them: the art is third-party (the user's own Steam library cache) and the kit's
licence note says no third-party art is committed (mockups/assets/LICENSE.md). The mockups fall
back to monograms and glyphs with the same real names when library.js is missing.

What it reads, and nothing else:
  - Steam (CDP, through glass.py js): collectionStore lists, appStore overviews (names, playtime,
    install state, compat category), SteamClient.Apps.ScanForInstalledNonSteamApps(true), the same
    read-only scan Steam's own "+" button runs on every press.
  - The Frame's file system over SFTP (read only): userdata/<id>/config/grid (custom art of shortcuts)
    and appcache/librarycache/<appid>/ (Steam's art cache).
It launches nothing, changes no setting and writes nothing on the Frame.
"""
import base64
import importlib.util
import io
import json
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
OUT = ROOT / "docs" / "refs" / "library"
HELPER = Path.home() / ".claude" / "skills" / "steam-frame-ssh" / "scripts" / "frame_ssh.py"
GRID = "/home/steamos/.local/share/Steam/userdata/*/config/grid"
CACHE = "/home/steamos/.local/share/Steam/appcache/librarycache"

JS_LISTS = r"""JSON.stringify((()=>{const cs=collectionStore, ov=id=>appStore.GetAppOverviewByAppID(id);
const L=c=>c?c.allApps.map(a=>a.appid):[];
const out={recent:L(cs.recentAppsCollection), all:L(cs.allGamesCollection).slice(0,40), frame:L(cs.frameGamesCollection),
 ready:L(cs.readyToPlayActiveCollection), installed:L(cs.localGamesCollection), nonsteam:L(cs.deckDesktopApps),
 user:cs.userCollections.map(c=>({id:c.id,name:c.displayName,n:c.allApps.length,first:c.allApps.slice(0,c.allApps.length<=40?40:9).map(a=>a.appid)}))};
out.q={half:cs.allAppsCollection.allApps.filter(a=>/half/i.test(a.display_name)).map(a=>a.appid)};
const ids=new Set([].concat(out.q.half,out.recent,out.all,out.frame.slice(0,9),out.ready.slice(0,9),out.installed.slice(0,9),out.nonsteam.slice(0,9),...out.user.map(u=>u.first)));
out.apps={}; for(const id of ids){const o=ov(id); if(!o) continue; out.apps[id]={name:o.display_name,min:o.minutes_playtime_forever||0,
 inst:o.installed===true?1:(o.installed===false?0:null), compat:o.steam_deck_compat_category||0, type:o.app_type, vr:!!o.vr_supported}}
return out})())"""

JS_PROGRAMS = r"""(async()=>{const r=await SteamClient.Apps.ScanForInstalledNonSteamApps(true);
return JSON.stringify(r.map(a=>({n:a.strAppName,exe:(a.strExePath||'').split('/').pop(),i:a.strIconDataBase64||''})))})()"""

# Steam's own filter (module 5757): always hidden, whatever the developer setting
ALWAYS_HIDDEN = {"steam", "vrurlhandler"}


def glass_js(expr):
    r = subprocess.run([sys.executable, str(ROOT / "glass.py"), "js", expr], capture_output=True, text=True, timeout=180)
    out = r.stdout.strip()
    i, j = min(x for x in (out.find("{"), out.find("[")) if x >= 0), max(out.rfind("}"), out.rfind("]"))
    return json.loads(out[i:j + 1])


def slug(s):
    return re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")


def fetch():
    from PIL import Image  # noqa: PLC0415
    lists = glass_js(JS_LISTS)
    progs = [p for p in glass_js(JS_PROGRAMS) if p["exe"] not in ALWAYS_HIDDEN]
    (OUT / "icons").mkdir(parents=True, exist_ok=True)
    (OUT / "art").mkdir(parents=True, exist_ok=True)
    plist = []
    for p in progs:
        rec = {"name": p["n"], "slug": slug(p["n"]), "icon": None}
        if p["i"]:
            b = base64.b64decode(p["i"])
            (OUT / "icons" / f"{rec['slug']}.png").write_bytes(b)
            rec["icon"] = list(Image.open(io.BytesIO(b)).size)
        plist.append(rec)
    (OUT / "programs.json").write_text(json.dumps(plist, indent=1))
    (OUT / "lists.json").write_text(json.dumps(lists, indent=1))

    spec = importlib.util.spec_from_file_location("frame_ssh", HELPER)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    client, _ = mod.connect()
    sftp = client.open_sftp()

    def sh(cmd):
        _, o, _ = client.exec_command(cmd, timeout=120)
        return o.read().decode(errors="replace")

    def find(appid):
        d = {}
        if int(appid) >= 2 ** 31:   # a non-Steam shortcut: custom art in the grid folder
            for p in sh(f"ls -d {GRID}/{appid}* 2>/dev/null").split():
                n = p.rsplit("/", 1)[1]
                if "backup" in n:
                    continue
                for k, pre in (("hero", f"{appid}_hero."), ("logo", f"{appid}_logo."), ("port", f"{appid}p.")):
                    if n.startswith(pre):
                        d.setdefault(k, p)
            return d
        names = {"library_hero.jpg": "hero", "logo.png": "logo", "library_600x900.jpg": "port", "library_capsule.jpg": "port2",
                 "header.jpg": "header", "library_header.jpg": "header2"}
        expr = " -o ".join(f"-name {n}" for n in names)
        for p in sh(f"find {CACHE}/{appid} -maxdepth 2 \\( {expr} \\) 2>/dev/null").split():
            d.setdefault(names[p.rsplit("/", 1)[1]], p)
        if "port" not in d and "port2" in d:
            d["port"] = d["port2"]
        if "header" not in d and "header2" in d:
            d["header"] = d["header2"]
        return d

    sizes = {"hero": (640, 640), "port": (200, 300), "header": (460, 215), "logo": (400, 400)}
    art = {}
    for appid in lists["apps"]:
        rec = {}
        for k, p in find(appid).items():
            if k not in sizes:
                continue
            try:
                with sftp.open(p, "rb") as f:
                    im = Image.open(io.BytesIO(f.read()))
                    im.load()
            except Exception:  # noqa: BLE001
                continue
            rec[k + "_src"] = list(im.size)
            im.thumbnail(sizes[k])
            if k == "logo":
                fn = f"{appid}_logo.png"
                im.convert("RGBA").save(OUT / "art" / fn)
            else:
                fn = f"{appid}_{k}.jpg"
                im.convert("RGB").save(OUT / "art" / fn, quality=86)
            rec[k] = fn
        art[appid] = rec
    (OUT / "art.json").write_text(json.dumps(art, indent=1))
    sftp.close()
    client.close()


def write_js():
    art = json.loads((OUT / "art.json").read_text())
    progs = json.loads((OUT / "programs.json").read_text())
    lists = json.loads((OUT / "lists.json").read_text()) if (OUT / "lists.json").exists() else {}
    lib = {"base": "../../refs/library/", "art": art, "programs": progs, "lists": lists}
    (OUT / "library.js").write_text("/* generated by docs/phase2/mockups/fetch-library-refs.py; git-ignored */\nwindow.LGS_LIB = "
                                    + json.dumps(lib, separators=(",", ":")) + ";\n", encoding="utf-8")
    print(f"{OUT / 'library.js'}: {len(art)} apps, {len(progs)} programs")


if __name__ == "__main__":
    if "--no-fetch" not in sys.argv:
        fetch()
    write_js()
