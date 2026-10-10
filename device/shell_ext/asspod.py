"""assPod: the player behind the bar's music note (device/rt/34-asspod.js, flag assPod).

The assPod itself (screen, click wheel, its place in your hand, the dimmed menu) runs in SteamVR's
systemui page (device/vr/systemui.asspod.js, at window.__LGS_VRX.asspod.api). This plugin is its
other half, the "daemon" it plays through:

  - VLC, started on demand (`vlc -I http`, 127.0.0.1 only, a random password, no video window,
    stopping after each item: the assPod's own player keeps the queue). The assPod shows its boot
    logo while VLC is starting, and only then. When the assPod is put away and nothing is playing,
    VLC is stopped again.
  - The library: VLC's media library, i.e. its saved Media Library list (ml.xspf) and its My Music
    and My Videos folders (the XDG music and videos folders), plus playlist files found there.
    ffprobe reads the tags; ffmpeg pulls covers (embedded, or cover.jpg / folder.jpg beside the
    files) and video thumbnails, on request. Results are cached in RAM (/tmp), never on disk.
  - A poll of the page while the assPod is out (10 a second) or something plays (2 a second): it
    takes the page's commands for VLC and hands back VLC's state.
  - Steam's side: while the assPod is out, Steam's runtime swallows gamepad input and relays A and B
    here (asspod.btn); the bridge value 'asspod' {open, hand, at, ttlMs} tells it when (a stale value
    ends the swallowing on its own, so a dead daemon never leaves Steam's input taken).

Actions
  asspod.open    (ui)  args {}: VLC up, library loaded, the assPod out in the laser's hand
  asspod.close   (ui)  args {}
  asspod.btn     (ui)  args {b: ok|menu|close, side, down}: Steam's A / B / hamburger while the assPod is out
  asspod.status  (read)
"""
import asyncio
import base64
import collections
import hashlib
import json
import os
import re
import secrets
import shutil
import signal
import socket
import struct
import time
import urllib.parse
import xml.etree.ElementTree as ET

ACTIONS = {
    "asspod.open": {"args": {}, "sources": ["bar", "barpopup", "main"], "rate": 0.5, "kind": "ui",
                    "flag": "assPod", "timeout": 40},
    "asspod.close": {"args": {}, "sources": ["bar", "barpopup", "main"], "rate": 0.2, "kind": "ui",
                     "flag": "assPod", "timeout": 10},
    "asspod.btn": {"args": {"b": {"type": "enum", "values": ["ok", "menu", "close"]},
                            "side": {"type": "enum", "values": ["left", "right"]}, "down": {"type": "bool"}},
                   "sources": "*", "rate": 0.02, "kind": "ui", "flag": "assPod", "timeout": 5, "global": False},
    "asspod.status": {"args": {}, "sources": "*", "rate": 0.2, "kind": "read", "flag": "assPod", "timeout": 10},
}

PAGE = "systemui"
MODEL_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.realpath(__file__))), "asspod", "model")   # the 3D body
PODD = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.realpath(__file__)))), "native", "podd", "podd")
PODD_SPEC = "/dev/shm/lgs/podd.json"
PODD_OUT = "/dev/shm/lgs/podd-out.json"
API = "window.__LGS_VRX && window.__LGS_VRX.asspod && window.__LGS_VRX.asspod.api"
HOME = os.path.expanduser("~")
FLATPAK_VLC = "org.videolan.VLC"
FFPROBE = shutil.which("ffprobe") or "/usr/bin/ffprobe"
FFMPEG = shutil.which("ffmpeg") or "/usr/bin/ffmpeg"
CACHE = "/tmp/lgs/asspod-tags.json"          # ffprobe results by path, size and mtime (RAM; gone at reboot)
CACHE_VERSION = 4                            # bump when _entry() files things differently (re-reads every file)
AUDIO = {".mp3", ".m4a", ".m4b", ".aac", ".flac", ".ogg", ".oga", ".opus", ".wav", ".wma", ".aif", ".aiff",
         ".alac", ".ape", ".mka", ".mpc", ".wv"}
VIDEO = {".mp4", ".m4v", ".mkv", ".webm", ".avi", ".mov", ".wmv", ".mpg", ".mpeg", ".ts", ".m2ts", ".3gp",
         ".flv", ".ogv"}
PLAYLISTS = {".m3u", ".m3u8", ".xspf", ".pls"}
COVERS = ("cover", "folder", "front", "albumart", "album", "albumartsmall")
EPISODE = re.compile(r"^(.*?)[ ._-]*S(\d{1,2})[ ._-]?E(\d{1,3})", re.I)   # Show.Name.S01E02
MAX_FILES = 6000
MAX_DEPTH = 8
PROBE_JOBS = 4
RESCAN_S = 60.0               # a new open rescans (cheap with the cache) once this old
VLC_START_S = 15.0
POLL_OPEN_S = 0.1
POLL_BG_S = 0.5
IDLE_STOP_S = 4.0             # away and not playing this long: VLC stops
BRIDGE_TTL_MS = 5000
BRIDGE_BEAT_S = 1.5
ART_MAX = 300                 # extracted images kept in memory
# VLC's equalizer presets, in VLC's order (the page's Settings > EQ uses the same names)
EQ_PRESETS = ["Flat", "Classical", "Club", "Dance", "Full Bass", "Full Bass & Treble", "Full Treble", "Headphones",
              "Large Hall", "Live", "Party", "Pop", "Reggae", "Rock", "Ska", "Soft", "Soft Rock", "Techno"]


# ------------------------------------------------------------------ helpers

def _st(ctx):
    s = ctx.state
    if not s:
        s.update({
            "vlc": None, "port": 0, "pw": "", "vlc_path": None, "vlc_state": "stopped", "vlc_status": None,
            "starting": None, "lock": asyncio.Lock(), "poll": None, "open": False, "hand": None,
            "playing": False, "idle_since": None, "lib": None, "lib_at": 0.0, "lib_sig": None, "lib_task": None,
            "art_src": {}, "art": collections.OrderedDict(), "art_jobs": set(), "vol": None, "eq": None,
            "bridge_at": 0.0, "log": collections.deque(maxlen=30), "errors": collections.deque(maxlen=10),
            "page_lib": None, "polls": 0, "paths": set(), "podd": None, "podd_spec": None,
        })
    return s


def _log(ctx, msg):
    s = _st(ctx)
    s["log"].append(time.strftime("%H:%M:%S ") + msg)
    ctx.log(msg)


def _err(ctx, msg):
    s = _st(ctx)
    s["errors"].append(time.strftime("%H:%M:%S ") + msg)
    ctx.log("error: " + msg)


def _pdeathsig():
    try:
        import ctypes
        ctypes.CDLL("libc.so.6", use_errno=True).prctl(1, int(signal.SIGTERM))   # PR_SET_PDEATHSIG
    except Exception:  # noqa: BLE001 - best effort
        pass


def _vlc_cmd_line():
    """How to run VLC here: the system's vlc, else the Flathub app (the installer offers it), else None."""
    v = shutil.which("vlc")
    if v:
        return [v]
    fp = shutil.which("flatpak")
    if fp:
        try:
            import subprocess
            if subprocess.run([fp, "info", FLATPAK_VLC], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
                              timeout=10).returncode == 0:
                return [fp, "run", "--command=vlc", FLATPAK_VLC]
        except (OSError, subprocess.SubprocessError):
            pass
    return None


def _free_port():
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sk:
        sk.bind(("127.0.0.1", 0))
        return sk.getsockname()[1]


def _uri(path):
    return "file://" + urllib.parse.quote(path)


def _id(path, prefix):
    return prefix + hashlib.sha1(path.encode("utf-8", "surrogateescape")).hexdigest()[:14]


async def _page(ctx, js, timeout=10):
    """Evaluates `js` (an expression over `A`, the page's api) in systemui; None without the api."""
    r = await ctx.vr_eval(PAGE, f"(() => {{ const A = {API}; if (!A) return null; return JSON.stringify(({js})); }})()", timeout)
    return json.loads(r) if isinstance(r, str) else None


async def _bridge(ctx, open_):
    s = _st(ctx)
    s["bridge_at"] = time.monotonic()
    v = {"open": bool(open_), "hand": s["hand"] if open_ else None, "at": int(time.time() * 1000), "ttlMs": BRIDGE_TTL_MS}
    try:
        await ctx.steam_eval(f"(window.__LGS_RT && window.__LGS_RT.bridge.set('asspod', {json.dumps(v)}), 0)", 5)
    except Exception as e:  # noqa: BLE001 - Steam reloading; the TTL covers it
        _err(ctx, f"bridge: {e!r}")


# ------------------------------------------------------------------ VLC

async def _http(ctx, params, timeout=3.0):
    """One call of VLC's HTTP interface (requests/status.json); its JSON, or None."""
    s = _st(ctx)
    if not s["port"]:
        return None
    q = urllib.parse.urlencode(params, doseq=True, quote_via=urllib.parse.quote)
    req = (f"GET /requests/status.json{'?' + q if q else ''} HTTP/1.0\r\nHost: 127.0.0.1\r\n"
           f"Authorization: Basic {base64.b64encode((':' + s['pw']).encode()).decode()}\r\n\r\n")
    try:
        r, w = await asyncio.wait_for(asyncio.open_connection("127.0.0.1", s["port"]), timeout)
        try:
            w.write(req.encode())
            await w.drain()
            data = await asyncio.wait_for(r.read(), timeout)
        finally:
            w.close()
    except (OSError, asyncio.TimeoutError):
        return None
    head, _, body = data.partition(b"\r\n\r\n")
    if b" 200 " not in head.split(b"\r\n", 1)[0]:
        return None
    try:
        return json.loads(body.decode("utf-8", "replace"))
    except ValueError:
        return None


def _vlc_running(s):
    p = s["vlc"]
    return p is not None and p.returncode is None


async def _start_vlc(ctx):
    """VLC up and answering; the page shows the boot logo meanwhile. True when ready."""
    s = _st(ctx)
    if _vlc_running(s) and s["port"]:
        return True
    if s["starting"] is not None:
        return await s["starting"]
    fut = asyncio.get_running_loop().create_future()
    s["starting"] = fut
    ok = False
    try:
        try:
            await _page(ctx, "A.setLoading(true)")
        except Exception:  # noqa: BLE001 - the logo is cosmetic
            pass
        base = await asyncio.get_running_loop().run_in_executor(None, _vlc_cmd_line)
        if base is None:
            _err(ctx, "VLC is not installed")
            try:
                await _page(ctx, "A.notice('VLC Needed', 'The assPod plays your music with VLC. Install it from Discover in Desktop Mode, or run the LiquidAss installer again.')")
            except Exception:  # noqa: BLE001
                pass
            return False
        s["port"] = _free_port()
        s["pw"] = secrets.token_hex(12)
        args = base + ["-I", "http", "--http-host", "127.0.0.1", "--http-port", str(s["port"]),
                "--http-password", s["pw"], "--no-video", "--no-video-title-show", "--play-and-stop",
                "--no-playlist-autostart", "--no-random", "--no-loop", "--no-repeat", "--no-media-library",
                "--no-metadata-network-access", "--no-one-instance", "--no-snapshot-preview", "--quiet"]
        env = dict(os.environ)
        env.pop("DISPLAY", None)
        env.pop("WAYLAND_DISPLAY", None)
        s["vlc"] = await asyncio.create_subprocess_exec(*args, stdin=asyncio.subprocess.DEVNULL,
                                                        stdout=asyncio.subprocess.DEVNULL,
                                                        stderr=asyncio.subprocess.DEVNULL,
                                                        env=env, preexec_fn=_pdeathsig)
        s["vlc_path"], s["vlc_state"], s["vol"], s["eq"] = None, "stopped", None, None
        deadline = time.monotonic() + VLC_START_S
        while time.monotonic() < deadline:
            if not _vlc_running(s):
                break
            if await _http(ctx, {}) is not None:
                ok = True
                break
            await asyncio.sleep(0.15)
        if ok:
            _log(ctx, f"vlc up (pid {s['vlc'].pid}, port {s['port']})")
        else:
            _err(ctx, "vlc did not start")
            await _stop_vlc(ctx)
    except Exception as e:  # noqa: BLE001
        _err(ctx, f"vlc start: {e!r}")
        await _stop_vlc(ctx)
    finally:
        s["starting"] = None
        fut.set_result(ok)
        try:
            await _page(ctx, "A.setLoading(false)")
        except Exception:  # noqa: BLE001
            pass
    return ok


async def _stop_vlc(ctx):
    s = _st(ctx)
    p = s["vlc"]
    s["vlc"], s["port"], s["vlc_path"], s["vlc_state"], s["vlc_status"] = None, 0, None, "stopped", None
    if p is None or p.returncode is not None:
        return
    try:
        p.terminate()
        await asyncio.wait_for(p.wait(), 3)
    except asyncio.TimeoutError:
        try:
            p.kill()
            await p.wait()
        except ProcessLookupError:
            pass
    except ProcessLookupError:
        pass
    _log(ctx, "vlc stopped")


async def _vlc_cmd(ctx, cmd):
    """One command from the page."""
    s = _st(ctx)
    op = cmd.get("op")
    if op == "art":
        k = cmd.get("key")
        if isinstance(k, str) and k not in s["art_jobs"]:
            s["art_jobs"].add(k)
            asyncio.get_running_loop().create_task(_send_art(ctx, k))
        return
    if op == "play":
        path = cmd.get("path")
        if not isinstance(path, str) or path not in s["paths"] or not os.path.isfile(path):
            _err(ctx, f"play: not in the library: {str(path)[:80]}")
            return
        if not await _start_vlc(ctx):
            return
        at = max(0.0, float(cmd.get("at") or 0))
        # until VLC gets there its reports still carry the old place (_vlc_report)
        s["vlc_target"] = (at, time.monotonic() + VLC_SETTLE_S)
        if s["vlc_path"] == path and s["vlc_state"] in ("playing", "paused"):
            await _http(ctx, {"command": "seek", "val": str(int(round(at)))})
            await _http(ctx, {"command": "pl_forceresume"})
        else:
            await _http(ctx, {"command": "pl_empty"})
            params = {"command": "in_play", "input": _uri(path)}
            if at >= 0.5:
                params["option"] = f"start-time={at:.2f}"
            await _http(ctx, params)
            s["vlc_path"] = path
        s["vlc_state"] = "playing"
        await _apply_audio(ctx, force=True)
        return
    if not _vlc_running(s):
        return
    if op == "pause":
        s["vlc_target"] = None
        await _http(ctx, {"command": "pl_forcepause"})
    elif op == "volume":
        await _apply_audio(ctx)
    elif op == "eq":
        await _apply_audio(ctx)


async def _apply_audio(ctx, force=False):
    """VLC's volume and EQ to the page's (the last poll's values)."""
    s = _st(ctx)
    want_vol, want_eq = s.get("want_vol"), s.get("want_eq")
    if want_vol is not None and (force or want_vol != s["vol"]):
        await _http(ctx, {"command": "volume", "val": str(int(round(want_vol * 256)))})
        s["vol"] = want_vol
    if want_eq is not None and (force or want_eq != s["eq"]):
        if want_eq in EQ_PRESETS:
            await _http(ctx, {"command": "enableeq", "val": "1"})
            await _http(ctx, {"command": "setpreset", "val": str(EQ_PRESETS.index(want_eq))})
        else:
            await _http(ctx, {"command": "enableeq", "val": "0"})
        s["eq"] = want_eq


VLC_SETTLE_S = 2.0       # longest a play or seek takes to show in VLC's reports


def _vlc_report(s, j):
    """VLC's status.json -> what the page's engine reads."""
    if not isinstance(j, dict):
        return None
    length = float(j.get("length") or 0)
    pos = float(j.get("position") or 0)
    t = pos * length if length > 0 else float(j.get("time") or 0)
    state = j.get("state") or "stopped"
    s["vlc_state"] = state
    # just after a play or a seek VLC still reports where it was: the target stands in until it arrives
    tgt = s.get("vlc_target")
    if tgt is not None:
        if abs(t - tgt[0]) < 2 or time.monotonic() > tgt[1]:
            s["vlc_target"] = None
        else:
            t, state = tgt[0], "playing"
    return {"state": state, "path": s["vlc_path"], "time": round(t, 3), "length": length,
            "at": int(time.time() * 1000)}


# ------------------------------------------------------------------ video pictures
# VLC plays a video's sound (--no-video: no window anywhere). Its picture for the assPod's screen comes
# from ffmpeg, decoding the same file into frames that follow VLC's clock: frames are taken as VLC's
# position reaches them (so a pause holds the decode), and a jump of more than VIDEO_RESYNC_S (a seek,
# Previous, the next video) starts the decode again at VLC's position. With podd running the frames are
# raw RGBA written to PODD_VIDEO, which podd puts in its texture under the screen (full rate); without
# it they are small JPEGs sent into SteamVR's page (which only manages about half the rate).

VIDEO_FPS = 24
VIDEO_INFLIGHT = 3            # frames on their way into the page at once
VIDEO_W = 320                 # the screen's own width (its 2x backing store would cost 4x the decode and redraw)
VIDEO_RESYNC_S = 1.0
VIDEO_DRIFT_S = 0.5
JPEG_SOI = bytes([0xFF, 0xD8])
JPEG_EOI = bytes([0xFF, 0xD9])
PODD_VIDEO = "/dev/shm/lgs/podd-video"
PODD_VIDEO_W, PODD_VIDEO_H = 320, 240     # podd's video tile (native/podd/podd.cpp VIDEO_W/H)
PODD_VIDEO_HDR = b"PVID"


def _vlc_time(s):
    """VLC's position now, as a steady clock: VLC's own reports jitter by tens of ms (and the polls
    reach it late), so the clock runs on its own and only follows VLC when it strays by more than
    VIDEO_DRIFT_S (a seek, a pause, the next video, or real drift)."""
    st = s.get("vlc_status") or {}
    t = float(st.get("time") or 0)
    playing = st.get("state") == "playing"
    if playing:
        t += max(0.0, time.time() - float(st.get("at") or 0) / 1000)
    c = s.get("video_clock")
    now = time.monotonic()
    if c is not None and c[2] == playing:
        est = c[0] + (now - c[1] if playing else 0.0)
        if abs(est - t) < VIDEO_DRIFT_S:
            return est
    s["video_clock"] = (t, now, playing)
    return t


async def _reap(p):
    """A killed decoder's end. Its stdout must be read to the end too: asyncio only reports the exit
    once every pipe has closed, and the frames still in the pipe keep it open (wait() alone hangs,
    which froze the picture after a seek)."""
    try:
        await asyncio.wait_for(p.communicate(), 3)
    except (asyncio.TimeoutError, ProcessLookupError, ValueError):
        pass


async def _video_stop(s):
    v = s.get("video")
    s["video"] = None
    if v and v["proc"].returncode is None:
        try:
            v["proc"].kill()
            await _reap(v["proc"])
        except ProcessLookupError:
            pass


def _podd_video(s):
    """podd is up to show the picture."""
    p = s.get("podd")
    return p is not None and p.returncode is None and s.get("podd_video")


def _write_podd_frame(seq, frame):
    tmp = PODD_VIDEO + ".tmp"
    with open(tmp, "wb") as f:
        f.write(PODD_VIDEO_HDR + struct.pack("<III", seq, PODD_VIDEO_W, PODD_VIDEO_H) + frame)
    os.replace(tmp, PODD_VIDEO)


def _remove_podd_frame():
    try:
        os.remove(PODD_VIDEO)
    except OSError:
        pass


async def _send_frame(ctx, path, frame):
    try:
        await _page(ctx, f"A.videoFrame({json.dumps(path)}, {json.dumps(base64.b64encode(frame).decode())})", 3)
    except Exception:  # noqa: BLE001 - the page is busy or reloading; the next frame will do
        pass


async def _video_frames(ctx, path):
    """Runs while the assPod shows `path`: decodes from VLC's position and sends the frame VLC is at."""
    s = _st(ctx)
    while s.get("video_want") == path:
        start = _vlc_time(s)
        raw = _podd_video(s)
        W, H = PODD_VIDEO_W, PODD_VIDEO_H
        if raw:
            out = ["-vf", f"fps={VIDEO_FPS},scale={W}:{H}:force_original_aspect_ratio=decrease,pad={W}:{H}:(ow-iw)/2:(oh-ih)/2",
                   "-f", "rawvideo", "-pix_fmt", "rgba", "pipe:1"]
        else:
            out = ["-vf", f"fps={VIDEO_FPS},scale={VIDEO_W}:-2", "-f", "image2pipe", "-c:v", "mjpeg", "-q:v", "6", "pipe:1"]
        p = await asyncio.create_subprocess_exec(
            FFMPEG, "-v", "error", "-ss", f"{start:.3f}", "-i", path, "-an", "-sn", *out,
            stdin=asyncio.subprocess.DEVNULL, stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.DEVNULL,
            preexec_fn=_pdeathsig)
        s["video"] = {"proc": p, "path": path}
        s["video_stage"] = f"decode from {start:.2f}"
        buf = b""
        n = 0
        resync = False
        inflight = set()
        try:
            while s.get("video_want") == path and not resync:
                chunk = await p.stdout.read(65536)
                if not chunk:
                    break
                buf += chunk
                while True:
                    if raw:
                        size = W * H * 4
                        if len(buf) < size:
                            break
                        frame, buf = buf[:size], buf[size:]
                    else:
                        a = buf.find(JPEG_SOI)          # a JPEG starts ...
                        b = buf.find(JPEG_EOI, a + 2) if a >= 0 else -1   # ... and ends
                        if a < 0 or b < 0:
                            break
                        frame, buf = buf[a:b + 2], buf[b + 2:]
                    ft = start + n / VIDEO_FPS
                    n += 1
                    # wait for VLC to reach this frame (paused: wait here); far off: start again there
                    while s.get("video_want") == path:
                        now_t = _vlc_time(s)
                        if abs(now_t - ft) > VIDEO_RESYNC_S:
                            s["video_resyncs"] = s.get("video_resyncs", 0) + 1
                            resync = True
                            break
                        if ft <= now_t + 0.5 / VIDEO_FPS:
                            break
                        await asyncio.sleep(min(0.04, ft - now_t))
                    if resync or s.get("video_want") != path:
                        break
                    if ft < _vlc_time(s) - 1.5 / VIDEO_FPS:
                        s["video_skipped"] = s.get("video_skipped", 0) + 1
                        continue           # behind: skip to catch up
                    if raw:
                        _write_podd_frame(n, frame)
                        s["video_sent"] = s.get("video_sent", 0) + 1
                        continue
                    # sent without waiting for the page's answer (a round trip into SteamVR's page takes
                    # longer than a frame): up to VIDEO_INFLIGHT at once; past that, this frame is dropped
                    inflight = {t for t in inflight if not t.done()}
                    if len(inflight) < VIDEO_INFLIGHT:
                        inflight.add(asyncio.get_running_loop().create_task(_send_frame(ctx, path, frame)))
        finally:
            if p.returncode is None:
                try:
                    p.kill()
                    await _reap(p)
                except ProcessLookupError:
                    pass
        s["video_stage"] = f"ended (resync {resync}, rc {p.returncode})"
        if not resync:
            # the file ended or ffmpeg stopped: wait for VLC to move somewhere else before starting again
            t0 = _vlc_time(s)
            while s.get("video_want") == path and abs(_vlc_time(s) - t0) < VIDEO_RESYNC_S:
                await asyncio.sleep(0.2)
    s["video"] = None
    _remove_podd_frame()


async def _video_guard(ctx, path):
    try:
        await _video_frames(ctx, path)
    except asyncio.CancelledError:
        raise
    except Exception as e:  # noqa: BLE001 - logged; the next change of video starts again
        _err(ctx, f"video: {e!r}")
    finally:
        _st(ctx)["video"] = None


def _video_follow(ctx, want):
    """The picture for `want` (the video the assPod's screen shows), or none."""
    s = _st(ctx)
    if s.get("video_want") == want:
        return
    s["video_want"] = want
    task = s.get("video_task")
    if task is not None and not task.done():
        task.cancel()
    s["video_task"] = asyncio.get_running_loop().create_task(_video_guard(ctx, want)) if want else None
    if not want:
        _remove_podd_frame()


# ------------------------------------------------------------------ the poll

POLL_JS = "(A.setStatus(%s), A.poll())"


async def _poll_loop(ctx):
    s = _st(ctx)
    while True:
        try:
            report = s["vlc_status"]
            r = await _page(ctx, POLL_JS % json.dumps(report), 5)
            s["polls"] += 1
            if r is None:            # the page script is gone (systemui reloaded, flag off)
                s["open"] = False
                if not s["playing"]:
                    break
            else:
                if isinstance(r.get("volume"), (int, float)):
                    s["want_vol"] = max(0.0, min(1.0, float(r["volume"])))
                if isinstance(r.get("eq"), str):
                    s["want_eq"] = r["eq"]
                async with s["lock"]:
                    for c in r.get("cmds") or []:
                        if isinstance(c, dict):
                            try:
                                await _vlc_cmd(ctx, c)
                            except Exception as e:  # noqa: BLE001
                                _err(ctx, f"cmd {c.get('op')}: {e!r}")
                was_open = s["open"]
                s["open"], s["playing"] = bool(r.get("open")), bool(r.get("playing"))
                if isinstance(r.get("holds"), dict):
                    s["holds"] = r["holds"]          # Reposition's places, kept for the next open
                # podd follows the body: on the hand (hold) or pinned in the room while repositioning (world)
                if s["open"] and s.get("podd") is not None and s["podd"].returncode is None:
                    h, w = r.get("hold") or {}, r.get("world")
                    fin = r.get("finish") if r.get("finish") in ("black", "white") else "black"
                    want = (json.dumps(h, sort_keys=True), json.dumps(w, sort_keys=True), fin)
                    if want != s.get("podd_pose") and h.get("rot") and h.get("centre"):
                        s["podd_pose"] = want
                        _podd_spec(s, rot=h["rot"], centre=h["centre"], world=w, finish=fin)
                if s["open"]:
                    s["hand"] = r.get("hand")
                if was_open and not s["open"]:
                    _log(ctx, f"put away ({r.get('closedBy')})")
                    await _bridge(ctx, False)
                    await _podd_stop(ctx)
                elif s["open"] and time.monotonic() - s["bridge_at"] > BRIDGE_BEAT_S:
                    await _bridge(ctx, True)
            if _vlc_running(s):
                s["vlc_status"] = _vlc_report(s, await _http(ctx, {}))
                _resume_note(s)
            # the video's picture, while the assPod shows it and VLC plays that file
            want = r.get("current") if r is not None and r.get("video") and s["vlc_path"] == r.get("current") else None
            _video_follow(ctx, want)
            # Away and nothing playing: VLC goes (the next open starts it again).
            if not s["open"] and not s["playing"]:
                if s["idle_since"] is None:
                    s["idle_since"] = time.monotonic()
                elif time.monotonic() - s["idle_since"] > IDLE_STOP_S:
                    async with s["lock"]:
                        await _stop_vlc(ctx)
                    break
            else:
                s["idle_since"] = None
            await asyncio.sleep(POLL_OPEN_S if s["open"] else POLL_BG_S)
        except asyncio.CancelledError:
            raise
        except Exception as e:  # noqa: BLE001 - page reloading; try again shortly
            _err(ctx, f"poll: {e!r}")
            await asyncio.sleep(1.0)
            if not s["open"] and not _vlc_running(s):
                break
    s["poll"] = None


def _ensure_poll(ctx):
    s = _st(ctx)
    if s["poll"] is None or s["poll"].done():
        s["idle_since"] = None
        s["poll"] = asyncio.get_running_loop().create_task(_poll_loop(ctx))


# ------------------------------------------------------------------ the library

def _xdg_dir(name, default):
    try:
        with open(os.path.join(HOME, ".config", "user-dirs.dirs"), encoding="utf-8") as f:
            for line in f:
                m = re.match(rf'^XDG_{name}_DIR="(.*)"\s*$', line.strip())
                if m:
                    return m.group(1).replace("$HOME", HOME)
    except OSError:
        pass
    return os.path.join(HOME, default)


def _ml_files():
    """VLC's saved Media Library list (VLC 3: ml.xspf in its data folder): [(path, title)]."""
    out = []
    data = os.environ.get("XDG_DATA_HOME") or os.path.join(HOME, ".local", "share")
    for p in (os.path.join(data, "vlc", "ml.xspf"),
              os.path.join(HOME, ".var", "app", "org.videolan.VLC", "data", "vlc", "ml.xspf")):
        out += _xspf(p)
    return out


def _xspf(path):
    out = []
    try:
        root = ET.parse(path).getroot()
    except (OSError, ET.ParseError):
        return out
    for el in root.iter():
        if el.tag.endswith("track"):
            loc = title = None
            for c in el:
                if c.tag.endswith("location") and c.text:
                    loc = c.text.strip()
                elif c.tag.endswith("title") and c.text:
                    title = c.text.strip()
            if loc and loc.startswith("file://"):
                out.append((urllib.parse.unquote(urllib.parse.urlparse(loc).path), title))
    return out


def _playlist_file(path):
    """Paths from a .m3u/.m3u8/.pls/.xspf file (relative entries against its folder)."""
    ext = os.path.splitext(path)[1].lower()
    if ext == ".xspf":
        return [p for p, _ in _xspf(path)]
    out = []
    base = os.path.dirname(path)
    try:
        with open(path, encoding="utf-8", errors="replace") as f:
            for line in f:
                line = line.strip()
                if ext == ".pls":
                    m = re.match(r"^File\d+=(.*)$", line)
                    line = m.group(1) if m else ""
                if not line or line.startswith("#"):
                    continue
                if line.startswith("file://"):
                    line = urllib.parse.unquote(urllib.parse.urlparse(line).path)
                elif "://" in line:
                    continue
                out.append(os.path.normpath(os.path.join(base, line)))
    except OSError:
        pass
    return out


def _walk(top, files, lists):
    top = os.path.realpath(top)
    if not os.path.isdir(top):
        return
    base_depth = top.count(os.sep)
    for d, dirs, names in os.walk(top, followlinks=False):
        dirs[:] = sorted(x for x in dirs if not x.startswith("."))
        if d.count(os.sep) - base_depth >= MAX_DEPTH:
            dirs[:] = []
        for n in sorted(names):
            if n.startswith("."):
                continue
            ext = os.path.splitext(n)[1].lower()
            p = os.path.join(d, n)
            if ext in AUDIO or ext in VIDEO:
                if len(files) < MAX_FILES:
                    files.setdefault(p, None)
            elif ext in PLAYLISTS:
                lists.append(p)


# Where each video was left (path -> seconds), kept across restarts. A video picks up there the next
# time it starts; one watched to within RESUME_END_S of its end starts over.
RESUME_FILE = os.path.join(os.environ.get("XDG_DATA_HOME") or os.path.join(HOME, ".local", "share"),
                           "glass-shell", "asspod-resume.json")
RESUME_MIN_S = 10.0
RESUME_END_S = 30.0
RESUME_SAVE_S = 5.0


def _resume(s):
    if s.get("resume") is None:
        try:
            with open(RESUME_FILE, encoding="utf-8") as f:
                d = json.load(f)
            s["resume"] = {k: float(v) for k, v in d.items() if isinstance(k, str) and isinstance(v, (int, float))}
        except (OSError, ValueError):
            s["resume"] = {}
    return s["resume"]


def _resume_save(s, force=False):
    if not s.get("resume_dirty") or (not force and time.monotonic() - s.get("resume_saved", 0) < RESUME_SAVE_S):
        return
    try:
        os.makedirs(os.path.dirname(RESUME_FILE), exist_ok=True)
        with open(RESUME_FILE + ".tmp", "w", encoding="utf-8") as f:
            json.dump(_resume(s), f)
        os.replace(RESUME_FILE + ".tmp", RESUME_FILE)
        s["resume_dirty"] = False
        s["resume_saved"] = time.monotonic()
    except OSError:
        pass


def _resume_note(s):
    """Follows VLC through a video: where it is, or (near the end) that it was finished."""
    st = s.get("vlc_status") or {}
    path = st.get("path")
    if st.get("state") != "playing" or path not in s.get("video_paths", ()):
        return
    t, length = float(st.get("time") or 0), float(st.get("length") or 0)
    r = _resume(s)
    if length > 0 and t >= length - RESUME_END_S:
        if r.pop(path, None) is not None:
            s["resume_dirty"] = True
    elif t >= RESUME_MIN_S and abs(r.get(path, -1) - t) >= 1:
        r[path] = round(t, 1)
        s["resume_dirty"] = True
    _resume_save(s)


LAB_MEDIA = "/tmp/lgs/asspod-media"   # lab only: test media in RAM, scanned like the folders when present


def _sources():
    music = _xdg_dir("MUSIC", "Music")
    videos = _xdg_dir("VIDEOS", "Videos")
    return [d for d in dict.fromkeys([music, videos, LAB_MEDIA]) if os.path.isdir(d)]


def _sig(paths):
    h = hashlib.sha1()
    for p in paths:
        try:
            st = os.stat(p)
            h.update(f"{p}:{st.st_size}:{st.st_mtime_ns}\n".encode("utf-8", "surrogateescape"))
        except OSError:
            pass
    return h.hexdigest()


async def _probe(path):
    try:
        p = await asyncio.create_subprocess_exec(FFPROBE, "-v", "quiet", "-print_format", "json", "-show_format",
                                                 "-show_streams", path, stdout=asyncio.subprocess.PIPE,
                                                 stderr=asyncio.subprocess.DEVNULL)
        out, _ = await asyncio.wait_for(p.communicate(), 15)
        return json.loads(out.decode("utf-8", "replace") or "{}")
    except (OSError, ValueError, asyncio.TimeoutError):
        return {}


def _tags(j):
    t = {}
    for src in [(j.get("format") or {}).get("tags") or {}] + [(x.get("tags") or {}) for x in j.get("streams") or []]:
        for k, v in src.items():
            t.setdefault(k.lower(), v)
    return t


def _num(v):
    m = re.match(r"^\s*(\d+)", str(v or ""))
    return int(m.group(1)) if m else 0


def _entry(path, j, st):
    """One file's catalog entry from its ffprobe JSON."""
    t = _tags(j)
    streams = j.get("streams") or []
    has_pic = any((x.get("disposition") or {}).get("attached_pic") for x in streams)
    is_video = any(x.get("codec_type") == "video" and not (x.get("disposition") or {}).get("attached_pic")
                   for x in streams) and os.path.splitext(path)[1].lower() in VIDEO
    try:
        dur = float((j.get("format") or {}).get("duration") or 0)
    except ValueError:
        dur = 0.0
    e = {"path": path, "duration": round(dur, 3), "added": int(st.st_mtime), "pic": has_pic,
         "title": t.get("title") or os.path.splitext(os.path.basename(path))[0]}
    if is_video:
        show = t.get("show") or t.get("tvshow") or ""
        genre = (t.get("genre") or "").lower()
        # an episode by its file name (Show.Name.S01E02...): its show is its folder (or the name before SxxEyy)
        ep = EPISODE.search(os.path.basename(path))
        if ep and not show:
            folder = os.path.basename(os.path.dirname(path))
            show = folder if folder.lower() not in ("videos", "video", "tv", "tv shows") else                 re.sub(r"[._]+", " ", ep.group(1)).strip()
        if ep:
            stem = os.path.splitext(os.path.basename(path))[0]
            if not t.get("title") or t.get("title") == stem or "." in t.get("title", ""):
                # the episode's name, when the file name has one after SxxEyy (before any "(480p ..." or
                # "1080p.BluRay" tags): "S04E01 Mac and Dennis - Manhunters"; else just "S01E01"
                rest = stem[ep.end():]
                rest = re.split(r"[(\[]|\b\d{3,4}p\b|\b(?:bluray|web-?dl|webrip|hdtv|dvd|x26[45]|h\.?26[45])\b", rest, 1, re.I)[0]
                name = re.sub(r"[._]+", " ", rest).strip(" -")
                e["title"] = f"S{int(ep.group(2)):02d}E{int(ep.group(3)):02d}" + (f" {name}" if name else "")
        elif not t.get("title") or t.get("title") == os.path.splitext(os.path.basename(path))[0]:
            # a movie's file name: "Guardians.of.the.Galaxy.2014.1080p.BluRay..." -> "Guardians of the Galaxy (2014)"
            stem = os.path.splitext(os.path.basename(path))[0]
            m = re.match(r"^(.*?)[ ._(\[]+((?:19|20)\d\d)(?:[ ._)\]]|$)", stem)
            name = m.group(1) if m else re.split(r"[(\[]|\b\d{3,4}p\b|\b(?:bluray|web-?dl|webrip|hdtv|dvd|x26[45])\b", stem, 1, re.I)[0]
            name = re.sub(r"[._]+", " ", name).strip(" -")
            if name:
                e["title"] = name + (f" ({m.group(2)})" if m else "")
        if show or t.get("season_number") or t.get("episode_id"):
            cat = "TV Shows"
        elif "podcast" in genre:
            cat = "Video Podcasts"
        elif t.get("artist") and 0 < dur < 900:
            cat = "Music Videos"
        else:
            cat = "Movies"
        e.update(kind="video", category=cat, artist=show or t.get("artist") or "")
    else:
        e.update(kind="song", artist=t.get("artist") or "", albumArtist=t.get("album_artist") or t.get("albumartist") or "",
                 album=t.get("album") or "", genre=t.get("genre") or "", composer=t.get("composer") or "",
                 trackNo=_num(t.get("track")), discNo=_num(t.get("disc")) or 1, year=_num(t.get("date") or t.get("year")))
    return e


def _cover_beside(path):
    d = os.path.dirname(path)
    try:
        names = os.listdir(d)
    except OSError:
        return None
    best = None
    for n in names:
        stem, ext = os.path.splitext(n)
        if ext.lower() in (".jpg", ".jpeg", ".png", ".webp") and stem.lower() in COVERS:
            if best is None or COVERS.index(stem.lower()) < COVERS.index(os.path.splitext(best)[0].lower()):
                best = n
    return os.path.join(d, best) if best else None


async def _scan(ctx):
    """The catalog the page's library.load() takes, built from VLC's media library."""
    s = _st(ctx)
    t0 = time.monotonic()
    loop = asyncio.get_running_loop()
    files, lists = {}, []
    ml = await loop.run_in_executor(None, _ml_files)
    for p, _ in ml:
        if os.path.splitext(p)[1].lower() in AUDIO | VIDEO and os.path.isfile(p):
            files.setdefault(p, None)
    sources = await loop.run_in_executor(None, _sources)
    for d in sources:
        await loop.run_in_executor(None, _walk, d, files, lists)
    try:
        with open(CACHE, encoding="utf-8") as f:
            cache = json.load(f)
    except (OSError, ValueError):
        cache = {}
    new_cache, todo = {}, []
    for p in files:
        try:
            st = os.stat(p)
        except OSError:
            continue
        key = f"{CACHE_VERSION}:{st.st_size}:{st.st_mtime_ns}"
        c = cache.get(p)
        if c and c.get("k") == key:
            new_cache[p] = c
        else:
            todo.append((p, st, key))
    sem = asyncio.Semaphore(PROBE_JOBS)

    async def one(p, st, key):
        async with sem:
            j = await _probe(p)
        new_cache[p] = {"k": key, "e": _entry(p, j, st)}

    await asyncio.gather(*(one(*x) for x in todo))
    try:
        os.makedirs(os.path.dirname(CACHE), exist_ok=True)
        with open(CACHE + ".tmp", "w", encoding="utf-8") as f:
            json.dump(new_cache, f)
        os.replace(CACHE + ".tmp", CACHE)
    except OSError:
        pass
    tracks, videos, art_src = [], [], {}
    for p in files:
        c = new_cache.get(p)
        if not c:
            continue
        e = dict(c["e"])
        if e.get("kind") == "video":
            e["id"] = _id(p, "v")
            e["art"] = "v:" + e["id"]
            art_src[e["art"]] = ("frame", p, e.get("duration") or 0)
            e.pop("pic", None)
            e.pop("kind", None)
            videos.append(e)
            continue
        e["id"] = _id(p, "t")
        if e.pop("pic", False):
            k = "a:" + _id(p, "p")
            art_src[k] = ("pic", p, 0)
            e["art"] = k
        else:
            cov = _cover_beside(p)
            if cov:
                k = "a:" + _id(cov, "c")
                art_src[k] = ("file", cov, 0)
                e["art"] = k
        e.pop("kind", None)
        tracks.append(e)
    by_path = {e["path"]: e["id"] for e in tracks + videos}
    playlists = []
    if ml:
        ids = [by_path[p] for p, _ in ml if p in by_path]
        if ids:
            playlists.append({"id": "vlc-ml", "title": "VLC Media Library", "items": ids})
    for lp in sorted(lists):
        ids = [by_path[p] for p in await loop.run_in_executor(None, _playlist_file, lp) if p in by_path]
        if ids:
            playlists.append({"id": _id(lp, "l"), "title": os.path.splitext(os.path.basename(lp))[0], "items": ids})
    s["art_src"] = art_src
    s["paths"] = {e["path"] for e in tracks + videos}      # the only files VLC is asked to play
    s["video_paths"] = {e["path"] for e in videos}
    _log(ctx, f"library: {len(tracks)} songs, {len(videos)} videos, {len(playlists)} playlists "
              f"({len(todo)} probed, {time.monotonic() - t0:.1f} s)")
    return {"tracks": tracks, "videos": videos, "playlists": playlists, "sources": sources + (["VLC Media Library"] if ml else []),
            "scanned": int(time.time())}


async def _load_library(ctx, force=False):
    s = _st(ctx)
    if s["lib_task"] is not None and not s["lib_task"].done():
        return await s["lib_task"]
    if not force and s["lib"] is not None and time.monotonic() - s["lib_at"] < RESCAN_S:
        return s["lib"]
    s["lib_task"] = asyncio.get_running_loop().create_task(_scan(ctx))
    try:
        s["lib"] = await s["lib_task"]
        s["lib_at"] = time.monotonic()
    finally:
        s["lib_task"] = None
    return s["lib"]


async def _push_library(ctx):
    """The page's library, when it does not have this catalog yet (a new scan, or systemui reloaded)."""
    s = _st(ctx)
    lib = await _load_library(ctx)
    sig = hashlib.sha1(json.dumps(lib, sort_keys=True).encode()).hexdigest()
    have = await _page(ctx, "A.status().library")
    if have is None:
        return False
    if sig == s["page_lib"] and have.get("tracks") == len(lib["tracks"]) and have.get("videos") == len(lib["videos"]):
        return True
    await _page(ctx, f"A.setLibrary({json.dumps(lib)})", 30)
    s["page_lib"] = sig
    return True


# ------------------------------------------------------------------ art

async def _extract(kind, path, dur):
    if kind == "frame":
        at = max(0.0, min(60.0, (dur or 0) * 0.1))
        args = [FFMPEG, "-v", "quiet", "-ss", f"{at:.2f}", "-i", path, "-frames:v", "1",
                "-vf", "scale=320:-2", "-f", "image2", "-c:v", "mjpeg", "-q:v", "5", "pipe:1"]
    else:
        args = [FFMPEG, "-v", "quiet", "-i", path, "-map", "0:v:0", "-frames:v", "1",
                "-vf", "scale=256:256:force_original_aspect_ratio=increase,crop=256:256", "-f", "image2",
                "-c:v", "mjpeg", "-q:v", "4", "pipe:1"]
    try:
        p = await asyncio.create_subprocess_exec(*args, stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.DEVNULL)
        out, _ = await asyncio.wait_for(p.communicate(), 20)
        return out if out[:2] == b"\xff\xd8" else None
    except (OSError, asyncio.TimeoutError):
        return None


async def _send_art(ctx, key):
    s = _st(ctx)
    try:
        data = s["art"].get(key)
        if data is None and key not in s["art"]:
            src = s["art_src"].get(key)
            data = await _extract(*src) if src else None
            s["art"][key] = data
            while len(s["art"]) > ART_MAX:
                s["art"].popitem(last=False)
        b64 = base64.b64encode(data).decode() if data else None
        await _page(ctx, f"A.receiveArt({json.dumps(key)}, {json.dumps(b64)})", 10)
    except Exception as e:  # noqa: BLE001
        _err(ctx, f"art {key}: {e!r}")
    finally:
        s["art_jobs"].discard(key)


# ------------------------------------------------------------------ the 3D body

def _model_dir():
    """The model's files, copied to RAM under a folder named for their content: SteamVR keeps a
    render model by its path, so a changed model must come from a new path."""
    h = hashlib.sha1()
    for d, dirs, names in os.walk(MODEL_DIR):
        dirs.sort()
        for n in sorted(names):
            p = os.path.join(d, n)
            st = os.stat(p)
            h.update(f"{os.path.relpath(p, MODEL_DIR)}:{st.st_size}:{st.st_mtime_ns};".encode())
    dst = os.path.join("/tmp/lgs/asspod-model", h.hexdigest()[:12])
    if not os.path.isdir(dst):
        shutil.rmtree("/tmp/lgs/asspod-model", ignore_errors=True)
        shutil.copytree(MODEL_DIR, dst)
    return dst


# ------------------------------------------------------------------ podd (native/podd: the body with real shaders)

def _podd_spec(s, **kw):
    spec = dict(s.get("podd_spec") or {"open": False, "hand": "right", "scale": 0.085 / 0.0618, "finish": "black"})
    spec.update(kw)
    s["podd_spec"] = spec
    os.makedirs(os.path.dirname(PODD_SPEC), exist_ok=True)
    with open(PODD_SPEC + ".tmp", "w", encoding="utf-8") as f:
        json.dump(spec, f)
    os.replace(PODD_SPEC + ".tmp", PODD_SPEC)


def _podd_kill_strays():
    """Ends every podd process of this user (by its binary's path) and waits for them to go."""
    pids = []
    for d in os.listdir("/proc"):
        if not d.isdigit():
            continue
        try:
            exe = os.readlink(f"/proc/{d}/exe")
        except OSError:
            continue
        if exe.replace(" (deleted)", "") == PODD:
            pids.append(int(d))
    for pid in pids:
        try:
            os.kill(pid, signal.SIGTERM)
        except OSError:
            pass
    deadline = time.time() + 2
    while pids and time.time() < deadline:
        pids = [p for p in pids if os.path.exists(f"/proc/{p}")]
        time.sleep(0.05)


async def _podd_start(ctx, model_dir, scale, finish):
    """podd up with its layout (podd-out.json), or None (then SteamVR's render models draw the body)."""
    s = _st(ctx)
    if not os.access(PODD, os.X_OK):
        return None
    _podd_spec(s, open=False, scale=scale, finish=finish)
    p = s.get("podd")
    # a podd older than its binary (a rebuild) is replaced
    if p is not None and p.returncode is None and os.path.getmtime(PODD) > s.get("podd_t0", 0):
        await _podd_stop(ctx)
        p = None
    if p is None or p.returncode is not None:
        # one left by an earlier copy of this plugin (a reload) holds podd's lock: it goes
        await asyncio.get_running_loop().run_in_executor(None, _podd_kill_strays)
        try:
            os.remove(PODD_OUT)
        except OSError:
            pass
        s["podd_t0"] = time.time()
        s["podd"] = await asyncio.create_subprocess_exec(PODD, "--model", model_dir, "--spec", PODD_SPEC, "--out", PODD_OUT,
                                                         stdin=asyncio.subprocess.DEVNULL, stdout=asyncio.subprocess.DEVNULL,
                                                         stderr=asyncio.subprocess.DEVNULL, preexec_fn=_pdeathsig)
    for _ in range(40):
        try:
            with open(PODD_OUT, encoding="utf-8") as f:
                out = json.load(f)
            if out.get("ok") and out.get("tiles") and out.get("pid") == s["podd"].pid:
                s["podd_video"] = bool(out.get("video"))
                return {k: out[k] for k in ("key", "texW", "texH", "pad", "box", "tiles", "video") if k in out}
        except (OSError, ValueError):
            pass
        if s["podd"].returncode is not None:
            _err(ctx, f"podd exited ({s['podd'].returncode})")
            return None
        await asyncio.sleep(0.1)
    _err(ctx, "podd gave no layout")
    return None


async def _podd_stop(ctx):
    s = _st(ctx)
    p = s.get("podd")
    s["podd"] = None
    if p is None or p.returncode is not None:
        await asyncio.get_running_loop().run_in_executor(None, _podd_kill_strays)
        return
    try:
        _podd_spec(s, open=False)
        p.terminate()
        await asyncio.wait_for(p.wait(), 3)
    except (ProcessLookupError, asyncio.TimeoutError):
        try:
            p.kill()
        except ProcessLookupError:
            pass


# ------------------------------------------------------------------ actions

async def _open(ctx):
    s = _st(ctx)
    st = await _page(ctx, "A.status()")
    if st is None:
        raise RuntimeError("the assPod page script is not installed in SteamVR (systemui)")
    if not st.get("open"):
        model_dir = _model_dir()
        podd = await _podd_start(ctx, model_dir, st.get("bodyScale") or 0.085 / 0.0618, st.get("finish") or "black")
        r = await _page(ctx, f"A.open({json.dumps({'modelDir': model_dir, 'podd': podd, 'holds': s.get('holds'), 'resume': _resume(s)})})")
        if not r or not r.get("open"):
            await _podd_stop(ctx)
            raise RuntimeError(f"open failed: {(r or {}).get('error')}")
        st = r
        hold = st.get("hold") or {}
        if podd and hold.get("rot") and hold.get("centre"):
            _podd_spec(s, open=True, hand=st.get("hand") or "right", rot=hold["rot"], centre=hold["centre"], world=None)
            s["podd_pose"] = None
    s["open"], s["hand"] = True, st.get("hand")
    await _bridge(ctx, True)
    _ensure_poll(ctx)
    # VLC (the boot logo shows while it starts) and the library, together
    vlc_ok, _ = await asyncio.gather(_start_vlc(ctx), _push_library(ctx))
    _log(ctx, f"open in the {s['hand']} hand (vlc {'up' if vlc_ok else 'down'})")
    return {"open": True, "hand": s["hand"], "vlc": bool(vlc_ok),
            "library": {"tracks": len((s["lib"] or {}).get("tracks", [])), "videos": len((s["lib"] or {}).get("videos", []))}}


async def run(ctx, atype, args):
    s = _st(ctx)
    if atype == "asspod.open":
        return await _open(ctx)
    if atype == "asspod.close":
        r = await _page(ctx, "A.close()")
        s["open"] = False
        await _bridge(ctx, False)
        await _podd_stop(ctx)
        return {"open": False, "page": bool(r)}
    if atype == "asspod.btn":
        r = await _page(ctx, f"A.btn({json.dumps(args['b'])}, {json.dumps(bool(args['down']))}, {json.dumps(args['side'])})", 3)
        return {"handled": bool(r)}      # a close is noticed by the poll, which tells Steam
    if atype == "asspod.status":
        page = None
        try:
            page = await _page(ctx, "A.status()")
        except Exception as e:  # noqa: BLE001
            page = {"error": repr(e)}
        return {"vlc": {"running": _vlc_running(s), "pid": s["vlc"].pid if _vlc_running(s) else None, "state": s["vlc_state"],
                        "path": s["vlc_path"]}, "open": s["open"], "hand": s["hand"], "playing": s["playing"],
                "polling": s["poll"] is not None and not s["poll"].done(), "polls": s["polls"],
                "library": {"tracks": len((s["lib"] or {}).get("tracks", [])), "videos": len((s["lib"] or {}).get("videos", []))},
                "video": {"raw": bool(_podd_video(s)), "sent": s.get("video_sent", 0), "skipped": s.get("video_skipped", 0),
                          "resyncs": s.get("video_resyncs", 0), "want": s.get("video_want"),
                          "task": None if s.get("video_task") is None else ("done" if s["video_task"].done() else "running"),
                          "stage": s.get("video_stage"), "clock": round(_vlc_time(s), 2)},
                "page": page, "log": list(s["log"]), "errors": list(s["errors"])}
    raise ValueError(atype)


async def tick(ctx):
    """Once a second: a VLC that died is forgotten; a playing VLC is always being polled."""
    s = _st(ctx)
    if s["vlc"] is not None and s["vlc"].returncode is not None:
        _err(ctx, f"vlc exited ({s['vlc'].returncode})")
        s["vlc"], s["port"], s["vlc_path"], s["vlc_state"] = None, 0, None, "stopped"
    if _vlc_running(s) or s["open"]:
        _ensure_poll(ctx)


async def stop(ctx):
    """Teardown (theme off, daemon exit, plugin reload): the assPod away, VLC gone, Steam's input back."""
    s = _st(ctx)
    if s["poll"] is not None:
        s["poll"].cancel()
        try:
            await s["poll"]
        except (asyncio.CancelledError, Exception):  # noqa: BLE001
            pass
        s["poll"] = None
    try:
        await _page(ctx, "A.close()", 3)
    except Exception:  # noqa: BLE001 - page gone
        pass
    _video_follow(ctx, None)
    _resume_save(s, force=True)
    await _stop_vlc(ctx)
    await _podd_stop(ctx)
    s["open"] = False
    await _bridge(ctx, False)
