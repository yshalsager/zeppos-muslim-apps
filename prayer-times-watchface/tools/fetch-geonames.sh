#!/usr/bin/env bash
# Downloads the GeoNames dumps tools/gen-cities.py needs into .cache/geonames (~210 MB, mostly
# alternateNamesV2.zip). GeoNames updates daily, so these aren't pinned; the generated city
# files are committed instead. Re-downloads only when the server copy is newer.
set -euo pipefail
cd "$(dirname "$0")/.."
dir=.cache/geonames
mkdir -p "$dir"
for f in cities15000.zip countryInfo.txt admin1CodesASCII.txt alternateNamesV2.zip; do
  if [ -f "$dir/$f" ]; then
    curl -sSfL -R -z "$dir/$f" -o "$dir/$f.part" "https://download.geonames.org/export/dump/$f"
  else
    curl -sSfL -R -o "$dir/$f.part" "https://download.geonames.org/export/dump/$f"
  fi
  if [ -s "$dir/$f.part" ]; then mv "$dir/$f.part" "$dir/$f"; else rm -f "$dir/$f.part"; fi
done
