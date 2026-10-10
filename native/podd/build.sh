#!/bin/sh
# Builds podd on the Frame (aarch64, GCC, GBM/EGL/GLES 3.2, SteamVR's own libopenvr_api), with
# glassd's GPU and math helpers (../glassd/src). Output: ./podd (where device/shell_ext/asspod.py
# looks: native/podd/podd).
#
#   sh build.sh            # release build
#   DEBUG=1 sh build.sh    # -O0 -g
set -e
cd "$(dirname "$0")"
INC=${OPENVR_INCLUDE:-$HOME/frametop/screens/build/include}
if [ ! -f "$INC/openvr.h" ]; then
    INC=../glassd/build/include
    if [ ! -f "$INC/openvr.h" ]; then
        mkdir -p "$INC"
        curl -fsSL "https://raw.githubusercontent.com/ValveSoftware/openvr/v2.15.6/headers/openvr.h" -o "$INC/openvr.h"
    fi
fi
mkdir -p build
if [ -n "$DEBUG" ]; then OPT="-O0 -g"; else OPT="-O2"; fi
VRLIB="-L/opt/steamvr/bin/linuxarm64 -lopenvr_api -Wl,-rpath,/opt/steamvr/bin/linuxarm64"
# shellcheck disable=SC2046
g++ -std=c++17 $OPT -Wall -Wno-missing-field-initializers -Wno-unused-function \
    -I"$INC" -I../glassd/src $(pkg-config --cflags egl glesv2 gbm) \
    podd.cpp -o build/podd \
    $(pkg-config --libs egl glesv2 gbm) $VRLIB -lpthread
install -m755 build/podd podd
echo "built $(pwd)/podd"
