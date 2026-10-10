#!/usr/bin/env python3
"""Export the assPod's 3D body into device/asspod/model/ (SteamVR render models).

The body is the original procedural model (tools/asspod-model/asspod-model.js, three.js). Its
exporter runs in a browser: this serves the repo on http://127.0.0.1:8766/, opens
tools/asspod-model/export.html, and writes the files the page sends back (only under
device/asspod/model/). Ctrl+C when it says "done".

  python tools/build_asspod_model.py [--no-open]
"""
import base64
import http.server
import json
import os
import sys
import webbrowser

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "device", "asspod", "model")
PORT = 8766


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **k):
        super().__init__(*a, directory=ROOT, **k)

    def log_message(self, fmt, *args):
        pass

    def do_POST(self):
        if self.path != "/asspod-model":
            self.send_error(404)
            return
        n = int(self.headers.get("Content-Length") or 0)
        files = json.loads(self.rfile.read(n).decode("utf-8"))
        written = 0
        for rel, v in files.items():
            dst = os.path.realpath(os.path.join(ROOT, rel))
            if not dst.startswith(os.path.realpath(OUT) + os.sep):
                print(f"refused {rel}")
                continue
            os.makedirs(os.path.dirname(dst), exist_ok=True)
            data = base64.b64decode(v["b64"]) if "b64" in v else v["text"].encode("utf-8")
            with open(dst, "wb") as f:
                f.write(data)
            written += 1
        print(f"done: {written} files in {os.path.relpath(OUT, ROOT)}")
        self.send_response(200)
        self.end_headers()
        self.wfile.write(b"ok")


def main():
    srv = http.server.ThreadingHTTPServer(("127.0.0.1", PORT), Handler)
    url = f"http://127.0.0.1:{PORT}/tools/asspod-model/export.html"
    print(f"serving {ROOT}; open {url}")
    if "--no-open" not in sys.argv[1:]:
        webbrowser.open(url)
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        pass
    return 0


if __name__ == "__main__":
    sys.exit(main())
