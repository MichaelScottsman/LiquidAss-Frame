#!/bin/sh
# Builds glassd on the Frame (aarch64, GCC, GBM/EGL/GLES 3, SteamVR's own
# libopenvr_api). Output: build/glassd, installed as ./glassd (where lgs-shell
# looks: native/glassd/glassd).
#
#   sh build.sh            # release build
#   DEBUG=1 sh build.sh    # -O0 -g
#   NOINSTALL=1 sh build.sh  # build/glassd only (tests before replacing the shared binary)
#   NOTOOLS=1 sh build.sh    # skip the verification tools
set -e
cd "$(dirname "$0")"

# OpenVR header with IVRIPCResourceManagerClient::ImportDmabuf (v2.15.6, the
# one frametop pins). SteamVR's runtime on the Frame supports its interfaces.
INC=${OPENVR_INCLUDE:-$HOME/frametop/screens/build/include}
if [ ! -f "$INC/openvr.h" ]; then
    INC=build/include
    if [ ! -f "$INC/openvr.h" ]; then
        mkdir -p "$INC"
        curl -fsSL "https://raw.githubusercontent.com/ValveSoftware/openvr/v2.15.6/headers/openvr.h" -o "$INC/openvr.h"
    fi
fi

mkdir -p build
# Embed the shaders as raw string literals ({"name", R"GLSL(...)GLSL"}).
gen=build/shaders.inc.tmp
: > "$gen"
for f in shaders/*.glsl shaders/*.vert shaders/*.frag; do
    [ -f "$f" ] || continue
    printf '{"%s", R"GLSL(' "$(basename "$f")" >> "$gen"
    cat "$f" >> "$gen"
    printf ')GLSL"},\n' >> "$gen"
done
mv "$gen" build/shaders.inc

if [ -n "$DEBUG" ]; then OPT="-O0 -g"; else OPT="-O2"; fi
VRLIB="-L/opt/steamvr/bin/linuxarm64 -lopenvr_api -Wl,-rpath,/opt/steamvr/bin/linuxarm64"
# shellcheck disable=SC2046
g++ -std=c++17 $OPT -Wall -Wno-missing-field-initializers -Wno-unused-function \
    -I"$INC" -Isrc -Ithird_party -Ibuild -I../shared $(pkg-config --cflags egl glesv2 gbm) \
    src/glassd.cpp -o build/glassd \
    $(pkg-config --libs egl glesv2 gbm) $VRLIB -lpthread
if [ -n "$NOINSTALL" ]; then
    echo "built $(pwd)/build/glassd (NOINSTALL: ./glassd left as it was)"
else
    install -m755 build/glassd glassd
    echo "built $(pwd)/glassd"
fi
[ -n "$NOTOOLS" ] && exit 0

# Verification tools (optional, see README "Verifying without the headset"):
#   ovgrab     reads an overlay back from SteamVR
#   fakeov     a Steam-like test overlay that moves and changes handle (tools/test_geometry.sh)
#   inview     where Steam's window and bar land in the passthrough feed (numbers only)
#   feedprobe  how the feed loopback behaves on short attaches (numbers only)
if g++ -std=c++17 -O2 -I"$INC" -Ithird_party tools/ovgrab.cpp -o build/ovgrab -lvulkan $VRLIB 2>build/ovgrab.log; then
    echo "built $(pwd)/build/ovgrab"
else
    echo "ovgrab not built (see build/ovgrab.log)"
fi
for t in fakeov inview; do
    g++ -std=c++17 -O2 -I"$INC" tools/$t.cpp -o build/$t $VRLIB 2>build/$t.log || echo "$t not built (see build/$t.log)"
done
g++ -std=c++17 -O2 tools/feedprobe.cpp -o build/feedprobe 2>build/feedprobe.log || echo "feedprobe not built (see build/feedprobe.log)"
