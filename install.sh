#!/bin/sh
# LiquidAss installer for the Steam Frame. Run it on the headset (desktop-mode
# terminal or SSH):
#
#   curl -fsSL https://github.com/MichaelScottsman/LiquidAss-Frame/releases/latest/download/install.sh | sh
#   curl -fsSL https://github.com/MichaelScottsman/LiquidAss-Frame/releases/latest/download/install.sh | sh -s -- uninstall
#
# or, from a copy of this file:  sh install.sh [install|uninstall]
#
# install    fetch the latest release, put it in ~/.local/share/glass-shell and
#            add "LiquidAss" to + > Launch Program. Running it again updates.
# uninstall  turn the theme off, remove the launcher entry, the files and
#            your saved glass settings.
#
# Environment:
#   LIQUIDASS_VERSION=v0.1      install that release instead of the latest
#   LIQUIDASS_ARCHIVE=FILE      install from a local LiquidAss-Frame.tar.gz (no download)
#   GITHUB_TOKEN=...            needed only while the repository is private
set -eu

REPO=MichaelScottsman/LiquidAss-Frame
ASSET=LiquidAss-Frame.tar.gz
DEST=$HOME/.local/share/glass-shell
APPS=$HOME/.local/share/applications
DESKTOP=$APPS/glass-shell.desktop
CONF=${XDG_CONFIG_HOME:-$HOME/.config}/glass-shell

say() { printf '%s\n' "LiquidAss: $*"; }
die() { printf '%s\n' "LiquidAss: $*" >&2; exit 1; }
py() { env -u LD_LIBRARY_PATH -u LD_PRELOAD PYTHONDONTWRITEBYTECODE=1 python3 -B "$@"; }

need() { command -v "$1" >/dev/null 2>&1 || die "this needs '$1', which is not installed"; }

# Download the release archive to $1.
fetch() {
    out=$1
    ver=${LIQUIDASS_VERSION:-}
    if [ -n "${GITHUB_TOKEN:-}" ]; then
        # Private repository: find the asset through the API, then download it by id.
        api=https://api.github.com/repos/$REPO/releases/latest
        [ -n "$ver" ] && api=https://api.github.com/repos/$REPO/releases/tags/$ver
        id=$(curl -fsSL -H "Authorization: Bearer $GITHUB_TOKEN" -H "Accept: application/vnd.github+json" "$api" \
            | py -c 'import json,sys; print(next(a["id"] for a in json.load(sys.stdin)["assets"] if a["name"]==sys.argv[1]))' "$ASSET") \
            || die "could not find $ASSET in release ${ver:-latest} (check GITHUB_TOKEN)"
        curl -fSL --progress-bar -H "Authorization: Bearer $GITHUB_TOKEN" -H "Accept: application/octet-stream" \
            -o "$out" "https://api.github.com/repos/$REPO/releases/assets/$id"
    else
        url=https://github.com/$REPO/releases/latest/download/$ASSET
        [ -n "$ver" ] && url=https://github.com/$REPO/releases/download/$ver/$ASSET
        curl -fSL --progress-bar -o "$out" "$url" \
            || die "download failed: $url (if the repository is private, set GITHUB_TOKEN)"
    fi
}

install_app() {
    need tar
    need python3
    tmp=$(mktemp -d)
    trap 'rm -rf "$tmp"' EXIT
    if [ -n "${LIQUIDASS_ARCHIVE:-}" ]; then
        cp "$LIQUIDASS_ARCHIVE" "$tmp/$ASSET"
    else
        need curl
        say "downloading ${LIQUIDASS_VERSION:-the latest release}"
        fetch "$tmp/$ASSET"
    fi
    mkdir "$tmp/new"
    tar -xzf "$tmp/$ASSET" -C "$tmp/new"
    [ -f "$tmp/new/device/lgs.py" ] || die "the archive is not a LiquidAss release"

    # A running LiquidAss is stopped for the swap (its files, glassd's binary included, vanish for a moment)
    # and started again after it, on the new version.
    was_on=0
    if command -v systemctl >/dev/null 2>&1 && systemctl --user is-active --quiet lgs-shell 2>/dev/null             && [ -f "$DEST/device/lgs.py" ]; then
        was_on=1
        say "turning LiquidAss off for the update"
        py "$DEST/device/lgs.py" off --quiet >/dev/null 2>&1 || true
    fi

    # Swap the whole folder so files a release dropped do not linger; keep a glassd built on this headset.
    mkdir -p "$(dirname "$DEST")"
    if [ -f "$DEST/native/glassd/glassd" ] && [ ! -e "$tmp/new/native/glassd/glassd" ]; then
        mkdir -p "$tmp/new/native/glassd"
        cp -p "$DEST/native/glassd/glassd" "$tmp/new/native/glassd/glassd"
    fi
    # Native glass out of the box: the release's shipped glassd (built for the Frame) when none was kept
    if [ ! -e "$tmp/new/native/glassd/glassd" ] && [ -f "$tmp/new/native/glassd/prebuilt/glassd" ]; then
        cp "$tmp/new/native/glassd/prebuilt/glassd" "$tmp/new/native/glassd/glassd"
        chmod 755 "$tmp/new/native/glassd/glassd"
    fi
    rm -rf "$DEST.old"
    [ -d "$DEST" ] && mv "$DEST" "$DEST.old"
    mv "$tmp/new" "$DEST"
    rm -rf "$DEST.old"
    chmod 755 "$DEST/device/lgs" "$DEST/device/lgs.py"

    # The launcher entry, pointed at this user's home.
    mkdir -p "$APPS"
    sed -e "s|/home/steamos/.local/share/glass-shell|$DEST|g" "$DEST/device/glass-shell.desktop" > "$DESKTOP"
    chmod 644 "$DESKTOP"
    update-desktop-database "$APPS" >/dev/null 2>&1 || true

    v=$(cat "$DEST/VERSION" 2>/dev/null || echo "")
    say "installed ${v:+$v }in $DEST"
    if [ "$was_on" = 1 ]; then
        py "$DEST/device/lgs.py" on --quiet >/dev/null 2>&1 && say "LiquidAss is back on (the new version)"             || say "could not turn LiquidAss back on: launch it from + > Launch Program > LiquidAss"
    else
        say "turn it on: dashboard bar > + > Launch Program > LiquidAss"
    fi
}

uninstall_app() {
    if [ -f "$DEST/device/lgs.py" ] && command -v python3 >/dev/null 2>&1; then
        py "$DEST/device/lgs.py" off --quiet >/dev/null 2>&1 || true
    fi
    rm -f "$DESKTOP"
    update-desktop-database "$APPS" >/dev/null 2>&1 || true
    rm -rf "$DEST" "$DEST.old" /tmp/lgs "$CONF"
    say "removed"
}

case "${1:-install}" in
    install) install_app ;;
    uninstall) uninstall_app ;;
    -h|--help|help) sed -n '2,20p' "$0" 2>/dev/null | sed 's/^# \{0,1\}//' || true ;;
    *) die "unknown command '$1' (use install or uninstall)" ;;
esac
