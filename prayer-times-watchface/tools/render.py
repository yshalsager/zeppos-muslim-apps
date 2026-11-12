"""Shared drawing helpers that mirror the widgets in watchface/index.js."""
import json
import subprocess
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
W, H, RADIUS = 432, 514, 106  # Bip Max screen
SCALE = 3  # supersample for smooth text

WHITE, DIM, GOLD, TEAL = (255, 255, 255), (156, 163, 175), (250, 204, 21), (45, 212, 191)
# Arabic text uses the same bundled font as the face (tools/gen-font.py) when present, so the edit
# previews and icon match the watch; SF Arabic otherwise (and for the weather digit images).
_NASKH = Path(__file__).resolve().parent.parent / "assets" / "bip-max" / "fonts" / "naskh.ttf"
ARABIC_FONT = str(_NASKH) if _NASKH.exists() else "/System/Library/Fonts/SFArabic.ttf"
SF_ARABIC = "/System/Library/Fonts/SFArabic.ttf"
LATIN_FONT = "/System/Library/Fonts/SFNS.ttf"

# Boxes (x, y, w, h) and text sizes — keep in sync with watchface/index.js
HIJRI = ((16, 34, W - 32, 44), 32)
CLOCK = ((0, 80, W, 120), 112)
GREG = ((16, 198, W - 32, 36), 26)
NEXT = ((16, 240, W - 32, 44), 30)
BAR = (116, 287, 200, 4)  # progress toward the next prayer (x, y, w, h), fills right-to-left
TRACK = (38, 38, 38)

# Prayer grid: 2 rows x 3 columns, filled right-to-left (Fajr | Sunrise | Dhuhr) (Asr | Maghrib | Isha)
GRID_Y, GRID_ROW_H, GRID_CELL_W = 296, 70, 132


def grid_x(col):
    return 16 + (2 - col) * 134  # col 0 is the rightmost


# Extras row below the grid: three cells, slot 0 is the rightmost (read first in RTL)
COMP_Y, COMP_H, COMP_W = 442, 52, 120
COMP_X = [276, 156, 36]
ICON = 24  # icon size in px


def sample_data():
    """Face strings for the preview date, computed by the face's own lib/ code."""
    out = subprocess.check_output(["node", str(ROOT / "tools" / "preview-data.mjs")], cwd=ROOT)
    return json.loads(out)


def _draw_icon(d, name, x, y, s, color):
    """Simple vector icons in a s×s box at (x, y)."""
    P = lambda fx, fy: (x + fx * s, y + fy * s)  # noqa: E731
    box = lambda a, b, c, e: [P(a, b), P(c, e)]  # noqa: E731
    if name == "heart":
        d.ellipse(box(0.06, 0.12, 0.52, 0.56), fill=color)
        d.ellipse(box(0.48, 0.12, 0.94, 0.56), fill=color)
        d.polygon([P(0.08, 0.42), P(0.92, 0.42), P(0.5, 0.9)], fill=color)
    elif name == "battery":
        d.rounded_rectangle(box(0.04, 0.26, 0.84, 0.74), radius=s * 0.1, outline=color, width=max(1, int(s * 0.08)))
        d.rectangle(box(0.86, 0.4, 0.96, 0.6), fill=color)
        d.rectangle(box(0.15, 0.37, 0.6, 0.63), fill=color)
    elif name == "steps":
        d.ellipse(box(0.1, 0.34, 0.42, 0.84), fill=color)
        d.ellipse(box(0.58, 0.12, 0.9, 0.62), fill=color)
        d.ellipse(box(0.16, 0.86, 0.36, 0.98), fill=color)
        d.ellipse(box(0.64, 0.64, 0.84, 0.76), fill=color)
    elif name == "flame":
        d.ellipse(box(0.2, 0.42, 0.8, 0.96), fill=color)
        d.polygon([P(0.21, 0.66), P(0.52, 0.04), P(0.79, 0.66)], fill=color)
    else:
        raise ValueError(name)


def icon_image(name, size=ICON, color=DIM):
    """An icon as a transparent PNG (for the watch's IMG widgets)."""
    im = Image.new("RGBA", (size * SCALE, size * SCALE), (0, 0, 0, 0))
    _draw_icon(ImageDraw.Draw(im), name, 0, 0, size * SCALE, color + (255,))
    return im.resize((size, size), Image.LANCZOS)


def digit_image(ch, size, color=WHITE):
    """One glyph (digit, degree, minus) as a PNG for TEXT_IMG font arrays."""
    arabic = ord(ch) >= 0x0600
    f = ImageFont.truetype(SF_ARABIC if arabic else LATIN_FONT, size * SCALE)
    l, t, r, b = f.getbbox(ch)
    asc, desc = f.getmetrics()
    w = max(1, r - l) + SCALE * 2
    im = Image.new("RGBA", (w, asc + desc), (0, 0, 0, 0))
    ImageDraw.Draw(im).text((SCALE - l, 0), ch, font=f, fill=color + (255,))
    return im.resize((max(1, w // SCALE), max(1, (asc + desc) // SCALE)), Image.LANCZOS)


class Canvas:
    """A transparent region of the screen at (ox, oy, w, h), drawn in screen coordinates."""

    def __init__(self, ox=0, oy=0, w=W, h=H):
        self.ox, self.oy, self.w, self.h = ox, oy, w, h
        self.im = Image.new("RGBA", (w * SCALE, h * SCALE), (0, 0, 0, 0))
        self.draw = ImageDraw.Draw(self.im)

    def text(self, box, s, size, color, system=False):
        if not all(ord(c) < 0x0600 for c in s):  # SF Arabic has no hyphen/dash/middle dot/plus/%
            bad = set("·–—-+%") & set(s)
            assert not bad, f"glyphs missing in SF Arabic {bad!r} in {s!r}"
        x, y, w, h = box
        latin = all(ord(c) < 0x0600 for c in s)
        f = ImageFont.truetype(LATIN_FONT if latin else (SF_ARABIC if system else ARABIC_FONT), size * SCALE)
        kw = {} if latin else {"direction": "rtl", "language": "ar"}
        cx = (x - self.ox + w / 2) * SCALE
        cy = (y - self.oy + h / 2) * SCALE
        self.draw.text((cx, cy), s, font=f, fill=color, anchor="mm", **kw)

    def bar(self, frac, color):
        x, y, w, h = BAR
        box = lambda a, b: [(a - self.ox) * SCALE, (y - self.oy) * SCALE, (b - self.ox) * SCALE, (y + h - self.oy) * SCALE]  # noqa: E731
        self.draw.rounded_rectangle(box(x, x + w), radius=2 * SCALE, fill=TRACK)
        fw = round(w * frac)
        if fw >= 2:
            self.draw.rounded_rectangle(box(x + w - fw, x + w), radius=2 * SCALE, fill=color)

    def icon(self, name, x, y, size=ICON, color=DIM):
        _draw_icon(self.draw, name, (x - self.ox) * SCALE, (y - self.oy) * SCALE, size * SCALE, color)

    def grid(self, cells):
        for i, c in enumerate(cells):
            row, col = divmod(i, 3)
            x, y = grid_x(col), GRID_Y + row * GRID_ROW_H
            self.text((x, y, GRID_CELL_W, 30), c["name"], 24, GOLD if c["on"] else DIM)
            self.text((x, y + 28, GRID_CELL_W, 38), c["time"], 32, GOLD if c["on"] else WHITE, system=True)

    def complication(self, slot, kind, value):
        """Extras cell: icon on the right, value to its left (weather: temperature + condition)."""
        x, y = COMP_X[slot], COMP_Y
        if kind == "none":
            return
        if kind == "weather":
            temp, cond = value
            self.text((x + COMP_W - 56, y, 56, COMP_H), temp, 26, WHITE, system=True)
            self.text((x, y, COMP_W - 58, COMP_H), cond, 20, DIM)
            return
        self.icon(kind, x + COMP_W - ICON - 4, y + (COMP_H - ICON) // 2)
        self.text((x, y, COMP_W - ICON - 8, COMP_H), value, 24, WHITE, system=True)

    def image(self, size=None):
        im = self.im.resize((self.w, self.h), Image.LANCZOS)
        return im.resize(size, Image.LANCZOS) if size else im


def rounded(im, radius):
    mask = Image.new("L", im.size, 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, im.width - 1, im.height - 1], radius=radius, fill=255)
    out = im.copy()
    out.putalpha(Image.composite(out.getchannel("A"), mask, mask))
    return out
