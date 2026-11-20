"""Previews of the app's screens, one set per language: the main page (wake-up mode, and "now" with
an alarm set), settings, the alarm confirmation and the ringing alarm.

Runs the real pages (tools/preview-data.mjs, on stub @zos modules) and draws the widgets they show:
BUTTONs, FILL_RECTs, IMGs and TEXTs, with ../../shared/widget_draw.py (HarfBuzz, FreeType, Noto Sans
and Noto Sans Arabic standing in for the system font, fetched by ../../scripts/fetch-fonts.sh). Fails
if a text is wider than its box.

By default writes only the README's Bip Max wake/now/ring images to ../docs/sleep-time/.
With --all writes every screen in both languages/shapes to ../.cache/previews/sleep-time/.
Round previews are rendered at 480 × 480 and reduced to 360 × 360. Both modes check text fit.
"""
import argparse
import json
import subprocess
import sys
from pathlib import Path

APP = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(APP.parent / "shared"))  # -I drops script dirs
from PIL import Image, ImageDraw  # noqa: E402

from widget_draw import draw, store_shot  # noqa: E402

ASSETS = APP / "assets"  # the images the pages show, per target (tools/gen-icon.py)
README_SHOTS = {f"{lang}-{shot}.png" for lang in ("en", "ar") for shot in ("wake", "now", "ring")}
STORE = "wake"  # the store's screenshot: docs/sleep-time/<lang>-{square,round}.png, 360 x 360
# screen → (target, width, height, corner radius, saved size)
SCREENS = {"": ("bip-max", 432, 514, 106, None), "round-": ("round-480", 480, 480, 240, 360)}
# name → page, main-page mode, page params
SHOTS = {
    "wake": ("index", "wake", ""),
    "now": ("index", "now", ""),
    "settings": ("settings", "", ""),
    "confirm": ("alarm", "", '{"wake":385,"sleep":450}'),  # the watch doesn't say whether DND is on
    "confirm-dnd": ("alarm", "dnd", '{"wake":385,"sleep":450}'),  # DND known on
    "ring": ("ring", "", ""),
}


def render(data, target, radius):
    """The screen with its corners (radius) transparent."""
    im = draw(data, ASSETS / target)
    mask = Image.new("L", (im.width * 4, im.height * 4), 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, mask.width - 1, mask.height - 1], radius=radius * 4, fill=255)
    im.putalpha(mask.resize(im.size, Image.LANCZOS))
    return im


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--all', action='store_true', help='Render every screen into .cache/previews/sleep-time')
    args = parser.parse_args()
    out = APP.parent / ('.cache/previews/sleep-time' if args.all else 'docs/sleep-time')
    out.mkdir(parents=True, exist_ok=True)
    for prefix, (target, w, h, radius, size) in SCREENS.items():
        for lang in ("en", "ar"):
            for shot, (page, mode, params) in SHOTS.items():
                name = f"{prefix}{shot}-{lang}.png" if prefix else f"{lang}-{shot}.png"
                if not args.all and name not in README_SHOTS and shot != STORE:
                    continue
                command = ["node", str(APP / "tools" / "preview-data.mjs"), page, lang, mode, params, str(w), str(h)]
                im = render(json.loads(subprocess.check_output(command, cwd=APP)), target, radius)
                if not args.all and shot == STORE:
                    store_shot(im).save(out / f"{lang}-{'round' if prefix else 'square'}.png", optimize=True)
                if size:
                    im = im.resize((size, size), Image.LANCZOS)
                if args.all or name in README_SHOTS:
                    im.save(out / name, optimize=True)
    print(f'wrote {len(SHOTS) * 4 if args.all else len(README_SHOTS)} previews to {out.relative_to(APP.parent)}')


if __name__ == "__main__":
    main()
