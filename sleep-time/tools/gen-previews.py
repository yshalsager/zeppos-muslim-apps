"""Previews of the app's screens, one set per language: the main page (wake-up mode, and "now" with
an alarm set), settings, the alarm confirmation and the ringing alarm.

Runs the real pages (tools/preview-data.mjs, on stub @zos modules) and draws the widgets they show:
BUTTONs, FILL_RECTs and TEXTs, with ../../shared/text_draw.py (HarfBuzz, FreeType, Noto Sans and Noto
Sans Arabic standing in for the system font, fetched by ../../scripts/fetch-fonts.sh). Fails if a
text is wider than its box.

Writes ../docs/sleep-time/<lang>-<name>.png: the Bip Max's 432 × 514 screen with its rounded
corners (radius 106) transparent; and round-<name>-<lang>.png: the 480 × 480 round design, shrunk to
the store's 360 × 360 with the outside of the circle transparent. Run: mise run :gen
"""
import json
import subprocess
import sys
from pathlib import Path

APP = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(APP.parent / "shared"))  # -I drops script dirs
from PIL import Image, ImageDraw  # noqa: E402

from text_draw import SCALE, is_arabic, line, system_font, wrap  # noqa: E402

ASSETS = APP / "assets"  # the images the pages show, per target (tools/gen-icon.py)
OUT = APP.parent / "docs" / "sleep-time"  # outside the app, so zeus doesn't pack it
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


def rgb(c):
    return ((c >> 16) & 255, (c >> 8) & 255, c & 255)


LINE = 1.2  # line height in text sizes, as measured on the watch (daad-keyboard)


def text(im, w, s, color):
    """Centred text; wrapped into lines if the widget wraps, which must then fit its box's height."""
    size = w["text_size"]
    lines = wrap(s, size, w["w"]) if w.get("text_style") == "WRAP" else [s]
    assert len(lines) == 1 or len(lines) * size * LINE <= w["h"], f"{s!r} needs {len(lines)} lines, its box is {w['h']} px tall"
    for i, s in enumerate(lines):
        width = system_font(s, size * SCALE).width(s, is_arabic(s)) / SCALE
        assert width <= w["w"], f"{s!r} is {width:.0f} px wide, its box {w['w']}"
        cy = w["y"] + w["h"] / 2 + (i - (len(lines) - 1) / 2) * size * LINE
        line(im, s, size, color, (w["x"] + w["w"] / 2) * SCALE, cy * SCALE)


def render(data, target, radius):
    S = SCALE
    im = Image.new("RGBA", (data["width"] * S, data["height"] * S), (0, 0, 0, 255))
    d = ImageDraw.Draw(im)
    for w in data["widgets"]:
        x, y, ww, hh = (w[k] * S for k in ("x", "y", "w", "h"))
        if w["type"] == "FILL_RECT":
            d.rounded_rectangle([x, y, x + ww - 1, y + hh - 1], radius=w.get("radius", 0) * S, fill=rgb(w["color"]))
        elif w["type"] == "IMG" or w.get("normal_src"):
            src = Image.open(ASSETS / target / (w.get("src") or w["normal_src"])).convert("RGBA")
            im.alpha_composite(src.resize((src.width * S, src.height * S), Image.LANCZOS), (int(x), int(y)))
        elif w["type"] == "BUTTON":
            d.rounded_rectangle([x, y, x + ww - 1, y + hh - 1], radius=w.get("radius", 0) * S, fill=rgb(w["normal_color"]))
            text(im, w, w["text"], rgb(w["color"]))
        elif w["type"] == "TEXT" and w.get("text"):
            text(im, w, w["text"], rgb(w["color"]))
    im = im.resize((data["width"], data["height"]), Image.LANCZOS)
    mask = Image.new("L", (im.width * 4, im.height * 4), 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, mask.width - 1, mask.height - 1], radius=radius * 4, fill=255)
    im.putalpha(mask.resize(im.size, Image.LANCZOS))
    return im


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    for prefix, (target, w, h, radius, size) in SCREENS.items():
        for lang in ("en", "ar"):
            for shot, (page, mode, params) in SHOTS.items():
                args = ["node", str(APP / "tools" / "preview-data.mjs"), page, lang, mode, params, str(w), str(h)]
                im = render(json.loads(subprocess.check_output(args, cwd=APP)), target, radius)
                if size:
                    im = im.resize((size, size), Image.LANCZOS)
                name = f"{prefix}{shot}-{lang}.png" if prefix else f"{lang}-{shot}.png"
                im.save(OUT / name, optimize=True)
            print(f"wrote docs/sleep-time/{name}")


if __name__ == "__main__":
    main()
