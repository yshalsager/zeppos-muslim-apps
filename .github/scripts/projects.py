"""Monorepo helpers for CI: which projects to build, and which project a release tag belongs to.

Projects are the [monorepo].config_roots in the root mise.toml, so adding an app there is enough.

  projects.py changed BASE HEAD   → JSON list of projects touched between two commits
                                    (all projects when shared files such as mise.toml change)
  projects.py tag TAG             → "dir version" for a release tag like prayer-times-watchface/v1.2.0
"""
import json
import re
import subprocess
import sys
import tomllib

with open("mise.toml", "rb") as f:
    PROJECTS = tomllib.load(f)["monorepo"]["config_roots"]

# Files outside the projects that affect every build.
SHARED = ("mise.toml", "mise.lock", "devices.json", ".github/", "scripts/", "shared/")


def changed(base, head):
    if not base or set(base) == {"0"}:  # new branch or first push: build everything
        return PROJECTS
    files = subprocess.check_output(["git", "diff", "--name-only", f"{base}...{head}"], text=True).split()
    if any(f == s or f.startswith(s) for f in files for s in SHARED):
        return PROJECTS
    return [p for p in PROJECTS if any(f.startswith(p + "/") for f in files)]


def tag(name):
    m = re.fullmatch(r"(.+)/v(\d+\.\d+\.\d+(?:[-+][\w.]+)?)", name)
    if not m or m.group(1) not in PROJECTS:
        sys.exit(f"tag {name!r} must look like <project>/vX.Y.Z with <project> one of {PROJECTS}")
    return f"{m.group(1)} {m.group(2)}"


if __name__ == "__main__":
    cmd, *args = sys.argv[1:]
    print(json.dumps(changed(*args)) if cmd == "changed" else tag(*args))
