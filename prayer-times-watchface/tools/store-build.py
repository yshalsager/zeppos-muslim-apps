"""Builds the Zepp store packages: one per screen size that has a store listing, in
../dist/prayer-times-watchface/<zeus name>-<target>.zab (outside the project: zeus empties its dist/
on every build and packs the project folder into the source archive).

The store takes one screen size per watch face listing (the console rejects a package with
"multiple resolutions"), so each devices.json target sold there has its own listing and appId:
PRAYER_TIMES_APP_ID for the Bip Max, PRAYER_TIMES_APP_ID_<TARGET> for the others (root mise.toml
[env], e.g. PRAYER_TIMES_APP_ID_ROUND_480). Targets without an appId are skipped. For each, this
writes app.json with only that target (and its appId), runs `zeus build` (keeping the source
archive the store uses), and puts app.json back. GitHub releases keep one .zab with every target.

  python3 -I tools/store-build.py [target ...]   (via `mise run :build-store`; default: every target)
"""
import json
import os
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT.parent / "dist" / ROOT.name


def env_var(target):
    return "PRAYER_TIMES_APP_ID" if target == "bip-max" else "PRAYER_TIMES_APP_ID_" + target.upper().replace("-", "_")


def build(target, app_id, original):
    app = json.loads(original)
    app["app"]["appId"] = int(app_id)
    app["targets"] = {target: app["targets"][target]}
    dist = ROOT / "dist"
    before = set(dist.glob("*.zab")) if dist.exists() else set()
    path = ROOT / "app.json"
    try:
        path.write_text(json.dumps(app, indent=2, ensure_ascii=False) + "\n")
        subprocess.run(["zeus", "build"], cwd=ROOT, check=True)
    finally:
        path.write_text(original)
    built = sorted(set(dist.glob("*.zab")) - before)
    # zeus can print an error and still exit 0 without writing a package
    if len(built) != 1:
        sys.exit(f"{target}: expected one new .zab in dist/, found {[p.name for p in built]}")
    OUT.mkdir(parents=True, exist_ok=True)
    out = OUT / (built[0].stem + f"-{target}.zab")
    built[0].rename(out)
    print(f"wrote {out.relative_to(ROOT.parent)}")


def main(targets):
    original = (ROOT / "app.json").read_text()
    all_targets = list(json.loads(original)["targets"])
    for t in targets or all_targets:
        if t not in all_targets:
            sys.exit(f"unknown target {t!r}; expected one of {all_targets}")
        app_id = os.environ.get(env_var(t), "")
        if not app_id.isdigit():
            print(f"skipped {t}: no store listing ({env_var(t)} not set in the root mise.toml [env])")
            continue
        build(t, app_id, original)


if __name__ == "__main__":
    main(sys.argv[1:])
