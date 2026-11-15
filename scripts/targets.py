"""Writes an app's app.json targets from the root devices.json. Run by each project's :gen.

An app names its screens by the keys of its app.json "targets" (devices.json keys). Each target gets
the first target's module, its screen width as designWidth, and its platforms: the ids of the watches
whose API level is at least the app's runtime minVersion, with the Bip Max's real-size fields if the
app has _pikeCompatibled. To add a screen: add `"<key>": {}` to the targets and run :gen.

  python3 scripts/targets.py PROJECT   (a folder name, e.g. sleep-time)
"""
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def version(s):
    return (tuple(int(x) for x in s.split(".")) + (0, 0))[:3]


def targets(app, devices):
    module = next(iter(app["targets"].values()))["module"]
    min_api = app["runtime"]["apiVersion"]["minVersion"]
    out = {}
    for t in app["targets"]:
        if t not in devices:
            sys.exit(f"target {t!r} isn't in devices.json")
        d = devices[t]
        ids = [i for w in d["watches"] if version(w["api"]) >= version(min_api) for i in w["ids"]]
        if not ids:
            sys.exit(f"target {t!r}: no watch has API {min_api} (devices.json)")
        extra = d.get("pike", {}) if app["app"].get("_pikeCompatibled") else {}
        out[t] = {"module": module, "platforms": [{"name": t, "deviceSource": i, **extra} for i in ids], "designWidth": d["width"]}
    return out


def main(project):
    path = ROOT / project / "app.json"
    app = json.loads(path.read_text())
    new = {**app, "targets": targets(app, json.loads((ROOT / "devices.json").read_text()))}
    if new != app:  # leave the file (and its formatting) alone when nothing changed
        path.write_text(json.dumps(new, indent=2, ensure_ascii=False) + "\n")
        print(f"wrote {path.relative_to(ROOT)}")


if __name__ == "__main__":
    assert version("4.2") == version("4.2.0") > version("3.6") and version("3.0.0") < version("3.5")
    main(*sys.argv[1:])
