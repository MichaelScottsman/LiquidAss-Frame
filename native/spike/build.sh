#!/bin/sh
# Builds the spikes on the Frame against SteamVR's own OpenVR runtime library.
set -e
cd "$(dirname "$0")"
INC=${OPENVR_INCLUDE:-$HOME/frametop/screens/build/include}
LIBS="-L/opt/steamvr/bin/linuxarm64 -lopenvr_api -Wl,-rpath,/opt/steamvr/bin/linuxarm64"
g++ -O1 -std=c++17 -I"$INC" -I. spike.cpp -o spike $LIBS -lvulkan
g++ -O1 -std=c++17 -I"$INC" keytest.cpp -o keytest $LIBS
g++ -O1 -std=c++17 -I"$INC" dmabuftest.cpp -o dmabuftest $LIBS -lgbm
g++ -O2 -std=c++17 -I"$INC" -I. hvgrab.cpp -o hvgrab $LIBS -lvulkan
echo built
