"""Draws a screen from the widgets a mini app shows, for its preview images.

The input is what an app's tools/preview-data.mjs prints after running its real pages on stub @zos
modules (../shared/zos-stub.mjs): {"width", "height", "widgets": [{type, x, y, w, h, ...}]}. Draws
FILL_RECTs, IMGs (and BUTTONs with an image), BUTTONs and TEXTs, with text_draw.py standing in for the
system font. Fails if a text is wider than its box, or, wrapped, taller.
"""
from PIL import Image, ImageDraw

from text_draw import SCALE, is_arabic, line, system_font, wrap

LINE = 1.2  # line height in text sizes, as measured on the watch (daad-keyboard)


def rgb(c):
    return ((c >> 16) & 255, (c >> 8) & 255, c & 255)


def text(im, w):
    """Wrapped into lines if the widget wraps; centred, or at the bottom of the box with align_v BOTTOM."""
    s, size = w["text"], w["text_size"]
    lines = wrap(s, size, w["w"]) if w.get("text_style") == "WRAP" else [s]
    assert len(lines) == 1 or len(lines) * size * LINE <= w["h"], f"{s!r} needs {len(lines)} lines, its box is {w['h']} px tall"
    for i, s in enumerate(lines):
        width = system_font(s, size * SCALE).width(s, is_arabic(s)) / SCALE
        assert width <= w["w"], f"{s!r} is {width:.0f} px wide, its box {w['w']}"
        if w.get("align_v") == "BOTTOM":
            cy = w["y"] + w["h"] - (len(lines) - i - 0.5) * size * LINE
        else:
            cy = w["y"] + w["h"] / 2 + (i - (len(lines) - 1) / 2) * size * LINE
        line(im, s, size, rgb(w["color"]), (w["x"] + w["w"] / 2) * SCALE, cy * SCALE)


def draw(data, assets=None):
    """The screen as an opaque RGBA image; IMG sources are read from `assets` (the target's folder)."""
    S = SCALE
    im = Image.new("RGBA", (data["width"] * S, data["height"] * S), (0, 0, 0, 255))
    d = ImageDraw.Draw(im)
    for w in data["widgets"]:
        x, y, ww, hh = (w[k] * S for k in ("x", "y", "w", "h"))
        if w["type"] == "FILL_RECT":
            d.rounded_rectangle([x, y, x + ww - 1, y + hh - 1], radius=w.get("radius", 0) * S, fill=rgb(w["color"]))
        elif w["type"] == "IMG" or w.get("normal_src"):
            src = Image.open(assets / (w.get("src") or w["normal_src"])).convert("RGBA")
            im.alpha_composite(src.resize((src.width * S, src.height * S), Image.LANCZOS), (int(x), int(y)))
        elif w["type"] == "BUTTON":
            d.rounded_rectangle([x, y, x + ww - 1, y + hh - 1], radius=w.get("radius", 0) * S, fill=rgb(w["normal_color"]))
            if w.get("text"):
                text(im, w)
        elif w["type"] == "TEXT" and w.get("text"):
            text(im, w)
    return im.resize((data["width"], data["height"]), Image.LANCZOS)
