#!/usr/bin/env bash
set -euo pipefail

install_path="${MISE_TOOL_INSTALL_PATH:?MISE_TOOL_INSTALL_PATH is required}"
mount_path="$(mktemp -d)"
trap 'hdiutil detach "$mount_path" -quiet; rmdir "$mount_path"' EXIT

hdiutil attach "$install_path/simulator.dmg" -mountpoint "$mount_path" -nobrowse -readonly -quiet
ditto "$mount_path/simulator.app" "$install_path/simulator.app"
test -x "$install_path/simulator.app/Contents/MacOS/simulator"

# The DMG ships the QEMU launcher and binaries without the executable bit
# (Zepp's docs tell you to `chmod +x start_qemu.sh` by hand); without it the
# Emulator button silently does nothing.
firmware_dir="$install_path/simulator.app/Contents/Resources/firmware"
chmod +x "$firmware_dir/start_qemu.sh" "$firmware_dir"/qemu_mac/*
test -x "$firmware_dir/start_qemu.sh"
test -x "$firmware_dir/qemu_mac/qemu-system-arm"
