"""Zepp store previews: the keyboard as the watch shows it, one per listing language.

Runs the real keyboard (tools/preview-data.mjs, on stub @zos modules) and draws the widgets it shows:
BUTTONs, FILL_RECTs and the field's TEXT, with ../../shared/text_draw.py (HarfBuzz, FreeType, Noto Sans
and Noto Sans Arabic standing in for the system font, fetched by ../../scripts/fetch-fonts.sh).

Writes ../docs/daad-keyboard/store/<lang>-round.png and <lang>-square.png, the app form's screenshots
(https://docs.zepp.com/docs/distribute/#app-introduction-screenshots): 360 × 360 PNGs on a transparent
background. Round: the screen fills the canvas, transparent outside the circle. Rectangular: the screen
scaled to the full height and centred. Run: mise run :gen
"""
import json
import subprocess
import sys
from pathlib import Path

APP = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(APP.parent / "shared"))  # -I drops script dirs
from PIL import Image, ImageDraw  # noqa: E402

from text_draw import SCALE, line, wrap  # noqa: E402

OUT = APP.parent / "docs" / "daad-keyboard" / "store"  # outside the app, so zeus doesn't pack it
# Listing language → the keyboard page and the text in the field
SAMPLES = {"ar": ("ar", "السلام عليكم ورحمة الله"), "en": ("en", "On my way, see you soon")}
LINE = 1.2  # line height in text sizes, as measured on the watch (data-widget/index.page.js)
SHOT = 360  # the app form's screenshot size, for both shapes
# shape → the screen drawn (width, height, input field height): the Active 2 Round as measured in the
# simulator, the Bip Max as measured on the watch
SHAPES = {"round": (466, 466, 146), "square": (432, 514, 132)}


def rgb(c):
    return ((c >> 16) & 255, (c >> 8) & 255, c & 255)


def render(data):
    S = SCALE
    im = Image.new("RGBA", (data["width"] * S, data["height"] * S), (0, 0, 0, 255))
    d = ImageDraw.Draw(im)
    for w in data["widgets"]:
        x, y, ww, hh = (w[k] * S for k in ("x", "y", "w", "h"))
        if w["type"] == "FILL_RECT":
            d.rectangle([x, y, x + ww - 1, y + hh - 1], fill=rgb(w["color"]))
        elif w["type"] == "BUTTON":
            d.rounded_rectangle([x, y, x + ww - 1, y + hh - 1], radius=w.get("radius", 0) * S, fill=rgb(w["normal_color"]))
            if w.get("text"):
                line(im, w["text"], w["text_size"], rgb(w["color"]), x + ww / 2, y + hh / 2)
        elif w["type"] == "TEXT" and w.get("text"):
            lines = wrap(w["text"], w["text_size"], w["w"])
            step = w["text_size"] * LINE * S
            # bottom-aligned, as the field: the last line sits at the bottom of the box
            for i, s in enumerate(lines):
                cy = y + hh - (len(lines) - i - 0.5) * step
                line(im, s, w["text_size"], rgb(w["color"]), x + ww / 2, cy)
    return im.resize((data["width"], data["height"]), Image.LANCZOS).convert("RGB")


def shot(screen, shape):
    canvas = Image.new("RGBA", (SHOT, SHOT), (0, 0, 0, 0))
    if shape == "round":
        mask = Image.new("L", (SHOT * 4, SHOT * 4), 0)
        ImageDraw.Draw(mask).ellipse([0, 0, SHOT * 4 - 1, SHOT * 4 - 1], fill=255)
        canvas.paste(screen.resize((SHOT, SHOT), Image.LANCZOS), (0, 0), mask.resize((SHOT, SHOT), Image.LANCZOS))
    else:
        w = round(screen.width * SHOT / screen.height)
        canvas.paste(screen.resize((w, SHOT), Image.LANCZOS), ((SHOT - w) // 2, 0))
    return canvas


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    for lang, (letters, text) in SAMPLES.items():
        for shape, (w, h, field) in SHAPES.items():
            data = json.loads(subprocess.check_output(
                ["node", str(APP / "tools" / "preview-data.mjs"), letters, text, str(w), str(h), str(field)], cwd=APP))
            path = OUT / f"{lang}-{shape}.png"
            shot(render(data), shape).save(path, optimize=True)
            print(f"wrote docs/daad-keyboard/store/{path.name} {SHOT}x{SHOT} ({w}x{h} screen) {path.stat().st_size // 1024} KB")


if __name__ == "__main__":
    main()
