"""Shared drawing helpers that mirror the widgets in watchface/index.js.

Text is shaped by HarfBuzz (uharfbuzz) and drawn by FreeType (freetype-py), both bundled in their
wheels, so the output is the same on macOS and Linux (CI) without Pillow's libraqm or system fonts.
tools/uax9.py puts the left-to-right and right-to-left runs of a line in visual order.
"""
import functools
import json
import math
import subprocess
from pathlib import Path

import freetype
import uharfbuzz as hb
from PIL import Image, ImageChops, ImageDraw

import uax9  # tools/ is on sys.path (the generators add it)

ROOT = Path(__file__).resolve().parent.parent
W, H, RADIUS = 432, 514, 106  # Bip Max screen
SCALE = 3  # supersample for smooth text

WHITE, DIM, GOLD, TEAL = (255, 255, 255), (156, 163, 175), (250, 204, 21), (45, 212, 191)
RED, ORANGE, NIGHT, AOD = (248, 113, 113), (251, 146, 60), (167, 139, 250), (138, 138, 138)  # watchface/index.js
# Fonts. Arabic text uses the face's bundled font (tools/gen-font.py), so previews match the watch.
# Text the watch draws in its system font uses Noto Sans / Noto Sans Arabic as a stand-in
# (downloaded by tools/fetch-fonts.sh, which `mise run :gen` runs first).
_FONTS = ROOT / ".cache" / "fonts"
ARABIC_FONT = ROOT / "assets" / "bip-max" / "fonts" / "naskh.ttf"
SYSTEM_ARABIC = _FONTS / "NotoSansArabic.ttf"
LATIN_FONT = _FONTS / "NotoSans.ttf"

# Boxes (x, y, w, h) and text sizes — keep in sync with watchface/index.js. Written for right-to-left;
# mirror() flips a box for left-to-right languages, as index.js box() does.
HIJRI = ((16, 34, W - 32, 44), 32)
CLOCK = ((0, 80, W, 120), 112)
GREG = ((48, 198, W - 96, 36), 26)
GEAR = (20, 204, 24, 24)  # ⚙ at the end of the date line (opens the settings menu)
NEXT = ((16, 240, W - 32, 44), 30)
BAR = (116, 287, 200, 4)  # progress toward the next prayer (x, y, w, h), fills in reading direction
TRACK = (38, 38, 38)

# Prayer grid: 2 rows x 3 columns, filled right-to-left (Fajr | Sunrise | Dhuhr) (Asr | Maghrib | Isha)
GRID_Y, GRID_ROW_H, GRID_CELL_W = 296, 70, 132


def grid_x(col):
    return 16 + (2 - col) * 134  # col 0 is the rightmost


# Extras row below the grid: three cells, slot 0 is the rightmost (read first in RTL)
COMP_Y, COMP_H, COMP_W = 442, 52, 120
COMP_X = [276, 156, 36]
ICON = 24  # icon size in px


def mirror(box, rtl=True):
    x, y, w, h = box
    return box if rtl else (W - x - w, y, w, h)


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
    elif name == "gear":  # 8 teeth around a ring (the hole is punched out: use via icon_image only)
        cx, cy = P(0.5, 0.5)
        for i in range(8):
            a = i * math.pi / 4
            d.polygon([(cx + math.cos(a + da) * r * s, cy + math.sin(a + da) * r * s)
                       for da, r in ((-0.22, 0.3), (0.22, 0.3), (0.14, 0.49), (-0.14, 0.49))], fill=color)
        d.ellipse(box(0.17, 0.17, 0.83, 0.83), fill=color)
        d.ellipse(box(0.36, 0.36, 0.64, 0.64), fill=(0, 0, 0, 0))
    else:
        raise ValueError(name)


def icon_image(name, size=ICON, color=DIM):
    """An icon as a transparent PNG (for the watch's IMG widgets)."""
    im = Image.new("RGBA", (size * SCALE, size * SCALE), (0, 0, 0, 0))
    _draw_icon(ImageDraw.Draw(im), name, 0, 0, size * SCALE, color + (255,))
    return im.resize((size, size), Image.LANCZOS)


class Font:
    """One font file at one pixel size."""

    def __init__(self, path, px):
        self.ft = freetype.Face(str(path))
        self.ft.set_pixel_sizes(0, px)
        self.hb = hb.Font(hb.Face(hb.Blob.from_file_path(str(path))))
        self.hb.scale = (px * 64, px * 64)  # 26.6 fixed point, as FreeType
        self.asc, self.desc = self.ft.size.ascender / 64, self.ft.size.descender / 64  # desc < 0
        self.pad = px  # room for marks above the ascender / below the descender

    def glyphs(self, s, rtl):
        """[(glyph id, x, y)] relative to the pen start on the baseline, and the advance width."""
        out, x = [], 0.0
        for text, run_rtl in uax9.runs(s, rtl):
            buf = hb.Buffer()
            buf.add_str(text)
            buf.guess_segment_properties()
            buf.direction = "rtl" if run_rtl else "ltr"
            hb.shape(self.hb, buf, {})
            for info, pos in zip(buf.glyph_infos, buf.glyph_positions):
                out.append((info.codepoint, x + pos.x_offset / 64, -pos.y_offset / 64))
                x += pos.x_advance / 64
        return out, x

    def width(self, s, rtl):
        return self.glyphs(s, rtl)[1]

    def mask(self, s, rtl):
        """Coverage of the line as an "L" image with the baseline at y = pad + asc and the pen
        starting at x = pad, plus its advance width."""
        glyphs, adv = self.glyphs(s, rtl)
        p = self.pad
        im = Image.new("L", (math.ceil(adv) + 2 * p, math.ceil(self.asc - self.desc) + 2 * p), 0)
        base = p + self.asc
        for gid, gx, gy in glyphs:
            self.ft.load_glyph(gid, freetype.FT_LOAD_DEFAULT | freetype.FT_LOAD_NO_HINTING)
            g = self.ft.glyph
            g.render(freetype.FT_RENDER_MODE_NORMAL)
            bm = g.bitmap
            if not (bm.width and bm.rows):
                continue
            glyph = Image.frombytes("L", (bm.width, bm.rows), bytes(bm.buffer))
            x, y = round(p + gx) + g.bitmap_left, round(base + gy) - g.bitmap_top
            box = (x, y, x + bm.width, y + bm.rows)
            im.paste(ImageChops.lighter(im.crop(box), glyph), box)
        return im, adv


@functools.cache
def font(path, px):
    return Font(path, px)


# Digit images share one box: DIGIT_LINE × size tall with the baseline DIGIT_BASE × size from the top
# (32 px tall at 26 px, fits the 34 px TEXT_IMG). The fonts' own line heights differ a lot (Noto Sans
# Arabic's is 2.1 em), and the digits of one font array have to line up.
DIGIT_LINE, DIGIT_BASE = 1.23, 0.96


def digit_image(ch, size, color=WHITE):
    """One glyph (digit, degree, minus) as a PNG for TEXT_IMG font arrays: its ink plus a pixel
    each side, in the shared digit box."""
    f = font(SYSTEM_ARABIC if ord(ch) >= 0x0600 else LATIN_FONT, size * SCALE)
    m, _ = f.mask(ch, rtl=False)
    l, _, r, _ = m.getbbox() or (f.pad, 0, f.pad + 1, 0)
    top = round(f.pad + f.asc - DIGIT_BASE * size * SCALE)
    m = m.crop((l - SCALE, top, r + SCALE, top + round(DIGIT_LINE * size * SCALE)))
    im = Image.new("RGBA", m.size, color + (255,))
    im.putalpha(m)
    return im.resize((max(1, m.width // SCALE), max(1, m.height // SCALE)), Image.LANCZOS)


class Canvas:
    """A transparent region of the screen at (ox, oy, w, h), drawn in screen coordinates.
    rtl=False: the face in a left-to-right language (mirrored layout, system font for words)."""

    def __init__(self, ox=0, oy=0, w=W, h=H, rtl=True):
        self.ox, self.oy, self.w, self.h, self.rtl = ox, oy, w, h, rtl
        self.im = Image.new("RGBA", (w * SCALE, h * SCALE), (0, 0, 0, 0))
        self.draw = ImageDraw.Draw(self.im)

    def text(self, box, s, size, color, system=False, fit=False, ltr=False):
        """fit: shrink the size until the line fits the box width (else it's drawn as given).
        ltr: lay out left to right, as the watch does for a string with no Arabic letter before its
        digits (e.g. "+٠.١")."""
        x, y, w, h = box
        latin = all(ord(c) < 0x0600 for c in s)
        path = LATIN_FONT if latin else (SYSTEM_ARABIC if system or not self.rtl else ARABIC_FONT)
        rtl = self.rtl and not latin and not ltr
        f = font(path, size * SCALE)
        while fit and size > 14 and f.width(s, rtl) > (w - 8) * SCALE:
            size -= 1
            f = font(path, size * SCALE)
        # centred like Pillow's anchor "mm": the advance width, and halfway between ascender and descender
        m, adv = f.mask(s, rtl)
        cx = (x - self.ox + w / 2) * SCALE
        cy = (y - self.oy + h / 2) * SCALE
        left, top = round(cx - adv / 2 - f.pad), round(cy + (f.asc + f.desc) / 2 - f.asc - f.pad)
        ink = Image.new("RGBA", self.im.size, tuple(color[:3]) + (0,))
        alpha = Image.new("L", self.im.size, 0)
        alpha.paste(m, (left, top))  # clipped to the canvas
        ink.putalpha(alpha)
        self.im.alpha_composite(ink)

    def mx(self, box):
        return mirror(box, self.rtl)

    def bar(self, frac, color):
        x, y, w, h = BAR
        box = lambda a, b: [(a - self.ox) * SCALE, (y - self.oy) * SCALE, (b - self.ox) * SCALE, (y + h - self.oy) * SCALE]  # noqa: E731
        self.draw.rounded_rectangle(box(x, x + w), radius=2 * SCALE, fill=TRACK)
        fw = round(w * frac)
        if fw >= 2:
            fx = self.mx((x + w - fw, y, fw, h))[0]
            self.draw.rounded_rectangle(box(fx, fx + fw), radius=2 * SCALE, fill=color)

    def icon(self, name, x, y, size=ICON, color=DIM):
        _draw_icon(self.draw, name, (x - self.ox) * SCALE, (y - self.oy) * SCALE, size * SCALE, color)

    def grid(self, cells):
        for i, c in enumerate(cells):
            row, col = divmod(i, 3)
            x, y = grid_x(col), GRID_Y + row * GRID_ROW_H
            self.text(self.mx((x, y, GRID_CELL_W, 30)), c["name"], 24, GOLD if c["on"] else DIM)
            self.text(self.mx((x, y + 28, GRID_CELL_W, 38)), c["time"], 32, GOLD if c["on"] else WHITE, system=True)

    def paste_icon(self, name, x, y, size=ICON, color=DIM):
        """An icon with see-through parts (e.g. the gear's hole), as the watch draws its PNG."""
        im = icon_image(name, size, color).resize((size * SCALE, size * SCALE), Image.LANCZOS)
        self.im.alpha_composite(im, ((x - self.ox) * SCALE, (y - self.oy) * SCALE))

    def paste_image(self, path, x, y):
        """An asset PNG at its own size, as the watch's IMG widget draws it."""
        im = Image.open(path).convert("RGBA")
        im = im.resize((im.width * SCALE, im.height * SCALE), Image.LANCZOS)
        self.im.alpha_composite(im, ((x - self.ox) * SCALE, (y - self.oy) * SCALE))

    def complication(self, slot, kind, value):
        """Extras cell: icon first in reading order, then the value (weather: temperature + condition)."""
        x, y = COMP_X[slot], COMP_Y
        if kind == "none":
            return
        if kind == "weather":
            temp, cond = value
            self.text(self.mx((x + COMP_W - 56, y, 56, COMP_H)), temp, 26, WHITE, system=True)
            if cond:
                self.text(self.mx((x, y, COMP_W - 58, COMP_H)), cond, 20, DIM)
            return
        ix, iy, _, _ = self.mx((x + COMP_W - ICON - 4, y + (COMP_H - ICON) // 2, ICON, ICON))
        self.icon(kind, ix, iy)
        self.text(self.mx((x, y, COMP_W - ICON - 8, COMP_H)), value, 24, WHITE, system=True)

    def image(self, size=None):
        im = self.im.resize((self.w, self.h), Image.LANCZOS)
        return im.resize(size, Image.LANCZOS) if size else im


def rounded(im, radius):
    mask = Image.new("L", im.size, 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, im.width - 1, im.height - 1], radius=radius, fill=255)
    out = im.copy()
    out.putalpha(Image.composite(out.getchannel("A"), mask, mask))
    return out
