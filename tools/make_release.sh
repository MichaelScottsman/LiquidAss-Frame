#!/bin/sh
# Builds the release archive install.sh downloads: dist/LiquidAss-Frame.tar.gz
# holds device/ theme/ lab/ native/ (tracked files at HEAD) and VERSION.
#
#   sh tools/make_release.sh v0.1
#   gh release create v0.1 dist/LiquidAss-Frame.tar.gz install.sh --title "LiquidAss v0.1"
set -eu
cd "$(dirname "$0")/.."
ver=${1:?usage: make_release.sh VERSION (e.g. v0.1)}
[ -z "$(git status --porcelain)" ] || { echo "commit your changes first" >&2; exit 1; }

mkdir -p dist
stage=$(mktemp -d)
trap 'rm -rf "$stage"' EXIT
python tools/build_asspod.py --check   # the assPod page script must match its sources
git archive --format=tar HEAD device theme lab native | tar -xf - -C "$stage"
printf '%s\n' "$ver" > "$stage/VERSION"
tar -czf dist/LiquidAss-Frame.tar.gz -C "$stage" VERSION device theme lab native
echo "dist/LiquidAss-Frame.tar.gz ($ver, $(git rev-parse --short HEAD))"
