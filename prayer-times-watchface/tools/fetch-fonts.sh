#!/usr/bin/env bash
# Downloads the source fonts for tools/gen-font.py into .cache/fonts (pinned, checksum-verified).
set -euo pipefail
cd "$(dirname "$0")/.."
dir=.cache/fonts
mkdir -p "$dir"

fetch() { # url file sha256
  local url=$1 file=$dir/$2 sum=$3
  if [ ! -f "$file" ] || ! echo "$sum  $file" | shasum -a 256 -c --status; then
    curl -sSfL -o "$file.part" "$url"
    echo "$sum  $file.part" | shasum -a 256 -c --status || { echo "checksum mismatch: $url" >&2; rm -f "$file.part"; exit 1; }
    mv "$file.part" "$file"
  fi
}

# SIL Scheherazade New 4.500 (OFL 1.1)
fetch https://github.com/silnrsi/font-scheherazade/releases/download/v4.500/ScheherazadeNew-4.500.zip \
  ScheherazadeNew-4.500.zip 49c789c21305bed13d90d7500877b50d62db1e8e4d6f7715178e556319ddbda9
[ -f "$dir/ScheherazadeNew-Medium.ttf" ] ||
  unzip -q -j -o "$dir/ScheherazadeNew-4.500.zip" 'ScheherazadeNew-4.500/ScheherazadeNew-Medium.ttf' -d "$dir"

# Noto Sans / Noto Sans Arabic (OFL 1.1), google/fonts pinned commit
noto=https://raw.githubusercontent.com/google/fonts/8b0a1d0f5983c89bc2b93f1b5fb55f9e252744b5/ofl
fetch "$noto/notosans/NotoSans%5Bwdth,wght%5D.ttf" NotoSans.ttf \
  bfb7bb691513f12e734dc346c03a03f784912432d7e3fa8e56efcf906fe86b3d
fetch "$noto/notosansarabic/NotoSansArabic%5Bwdth,wght%5D.ttf" NotoSansArabic.ttf \
  63111b5b2e074dd48cc67692e0a2726d86ee94c1c37fe8598257b7b4e87e869e
