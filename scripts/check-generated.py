"""Fails if regenerating changed anything that's committed. Run after a project's :gen (CI).

PNGs are compared by pixels: the generators draw the same pixels on macOS and Linux, but Pillow's
zlib compresses them into different bytes on arm64 and x86_64. Every other file must match exactly.
Only the generators' outputs are checked (PATHS), so local edits to sources don't count.

  python3 scripts/check-generated.py PATH...   (the outputs, relative to the repo root)
"""
import io
import subprocess
import sys

from PIL import Image, ImageChops


def git(*args):
    return subprocess.check_output(["git", *args], cwd=ROOT)


ROOT = subprocess.check_output(["git", "rev-parse", "--show-toplevel"], text=True).strip()


def same_pixels(path):
    # premultiplied, so the colour of fully transparent pixels doesn't count; all four channels
    # (getbbox() alone would look only at alpha)
    old = Image.open(io.BytesIO(git("show", f"HEAD:{path}"))).convert("RGBA").convert("RGBa")
    new = Image.open(f"{ROOT}/{path}").convert("RGBA").convert("RGBa")
    return old.size == new.size and ImageChops.difference(old, new).getbbox(alpha_only=False) is None


def main(paths):
    status = git("status", "--porcelain", "--untracked-files=all", "-z", "--", *paths).decode().split("\0")
    stale = []
    for entry in filter(None, status):
        code, path = entry[:2], entry[3:]
        if code == " M" and path.endswith(".png") and same_pixels(path):
            continue
        stale.append(f"{code} {path}")
    if stale:
        print("Generated files differ from the committed ones; run `mise run :gen` and commit:")
        print("\n".join(f"  {s}" for s in stale))
        sys.exit(1)
    print("generated files match the committed ones")


if __name__ == "__main__":
    main(sys.argv[1:] or ["."])
