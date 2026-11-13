"""Shared drawing helpers that mirror the widgets in watchface/index.js.

Boxes come from lib/layout.js (via tools/layout-data.mjs) for each devices.json target, so every
target's previews match its watch. device(target) holds a target's screen, layout and assets folder.

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
SCALE = 3  # supersample for smooth text

WHITE, DIM, GOLD, TEAL = (255, 255, 255), (156, 163, 175), (250, 204, 21), (45, 212, 191)
RED, ORANGE, NIGHT, AOD = (248, 113, 113), (251, 146, 60), (167, 139, 250), (138, 138, 138)  # watchface/index.js
# Fonts. Arabic text uses the face's bundled font (tools/gen-font.py), so previews match the watch.
# Text the watch draws in its system font uses Noto Sans / Noto Sans Arabic as a stand-in
# (downloaded by tools/fetch-fonts.sh, which `mise run :gen` runs first).
_FONTS = ROOT / ".cache" / "fonts"
SYSTEM_ARABIC = _FONTS / "NotoSansArabic.ttf"
LATIN_FONT = _FONTS / "NotoSans.ttf"
LUCIDE_FONT = _FONTS / "lucide.ttf"  # Lucide icons (ISC), glyphs on a 1000-unit em square

# Weather icon per Zepp weather code 0–28 (IMG_LEVEL + data_type.WEATHER picks one; Zepp watchface
# spec "Type data"). None = unknown weather (25): a transparent image.
WEATHER_ICONS = [
    "cloud-sun", "cloud-sun-rain", "cloud-snow", "sun", "cloudy",  # 0 cloudy, shower, snow shower, sunny, overcast
    "cloud-drizzle", "cloud-snow", "cloud-rain", "cloud-snow", "snowflake",  # 5 light rain, light/moderate snow, moderate rain, heavy snow
    "cloud-rain-wind", "wind", "cloud-hail", "cloud-fog", "haze",  # 10 heavy rain, sandstorm, sleet, fog, haze
    "cloud-lightning", "snowflake", "wind", "cloud-rain-wind", "cloud-hail",  # 15 thundershower, snowstorm, dust, extreme rainstorm, rain with hail
    "cloud-lightning", "cloud-rain-wind", "wind", "tornado", "cloud-rain-wind",  # 20 thunder with hail, heavy rainstorm, blowing sand, strong sandstorm, rainstorm
    None, "cloud-moon", "cloud-moon-rain", "moon",  # 25 unknown, cloudy / shower / clear at night
]
SAMPLE_WEATHER = "cloud-sun"  # previews and screenshots

TRACK = (38, 38, 38)  # progress bar track

_DEVICES = {k: v for k, v in json.loads((ROOT / "devices.json").read_text()).items() if not k.startswith("/")}
TARGETS = list(_DEVICES)  # the first is the one the docs show


class Device:
    """One devices.json target: screen (w, h, radius), picker preview size, layout boxes (L, as in
    lib/layout.js, right-to-left) and its assets folder."""

    def __init__(self, target):
        p = _DEVICES[target]
        self.target, self.w, self.h, self.radius = target, p["width"], p["height"], p["radius"]
        self.preview = tuple(p["preview"])
        self.L = json.loads(subprocess.check_output(["node", str(ROOT / "tools" / "layout-data.mjs"), target], cwd=ROOT))
        self.icon = self.L["icon"]
        self.assets = ROOT / "assets" / target
        self.arabic_font = self.assets / "fonts" / "naskh.ttf"  # tools/gen-font.py


@functools.cache
def device(target=None):
    return Device(target or TARGETS[0])


def rect(b):
    """A lib/layout.js box as (x, y, w, h)."""
    return (b["x"], b["y"], b["w"], b["h"])


def mirror(box, rtl, width):
    """A right-to-left box for the reading direction (as watchface/index.js box())."""
    x, y, w, h = box
    return box if rtl else (width - x - w, y, w, h)


def sample_data():
    """Face strings for the preview date, computed by the face's own lib/ code."""
    out = subprocess.check_output(["node", str(ROOT / "tools" / "preview-data.mjs")], cwd=ROOT)
    return json.loads(out)


# The face's own icons (assets icons/<name>.png) → Lucide icon
ICONS = {"steps": "footprints", "heart": "heart", "battery": "battery-full", "flame": "flame", "gear": "settings"}


def icon_image(name, size, color=DIM):
    """One of the face's icons as a transparent PNG (for the watch's IMG widgets)."""
    return lucide_image(ICONS[name], size, color, scale=1)


@functools.cache
def _lucide_codepoints():
    return json.loads((_FONTS / "lucide-codepoints.json").read_text())


def lucide_image(name, size, color=DIM, scale=SCALE):
    """A Lucide icon as a transparent size×size image (size × scale when scale > 1)."""
    px = size * SCALE
    f = font(LUCIDE_FONT, px)
    m, _ = f.mask(chr(_lucide_codepoints()[name]), rtl=False)
    top = round(f.pad + f.asc - px)  # the em square: px wide from the pen, px tall down from the ascender
    m = m.crop((f.pad, top, f.pad + px, top + px))
    im = Image.new("RGBA", m.size, color + (255,))
    im.putalpha(m)
    return im if scale == SCALE else im.resize((size * scale, size * scale), Image.LANCZOS)


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
    """A transparent region of a device's screen at (ox, oy, w, h) (default: all of it), drawn in
    screen coordinates. rtl=False: the face in a left-to-right language (mirrored layout, system
    font for words)."""

    def __init__(self, dev, ox=0, oy=0, w=None, h=None, rtl=True):
        w, h = w or dev.w, h or dev.h
        self.dev, self.L = dev, dev.L
        self.ox, self.oy, self.w, self.h, self.rtl = ox, oy, w, h, rtl
        self.im = Image.new("RGBA", (w * SCALE, h * SCALE), (0, 0, 0, 0))
        self.draw = ImageDraw.Draw(self.im)

    def text(self, box, s, size, color, system=False, fit=False, ltr=False):
        """fit: shrink the size until the line fits the box width (else it's drawn as given).
        ltr: lay out left to right, as the watch does for a string with no Arabic letter before its
        digits (e.g. "+٠.١")."""
        x, y, w, h = box
        latin = all(ord(c) < 0x0600 for c in s)
        path = LATIN_FONT if latin else (SYSTEM_ARABIC if system or not self.rtl else self.dev.arabic_font)
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
        """A layout box (dict or tuple) as (x, y, w, h) in reading direction."""
        return mirror(rect(box) if isinstance(box, dict) else box, self.rtl, self.dev.w)

    def label(self, b, s, color, system=False, **kw):
        """Text in a layout text box (its own text_size), in reading direction."""
        self.text(self.mx(b), s, b["text_size"], color, system=system, **kw)

    def bar(self, frac, color):
        x, y, w, h = rect(self.L["bar"])
        box = lambda a, b: [(a - self.ox) * SCALE, (y - self.oy) * SCALE, (b - self.ox) * SCALE, (y + h - self.oy) * SCALE]  # noqa: E731
        self.draw.rounded_rectangle(box(x, x + w), radius=2 * SCALE, fill=TRACK)
        fw = round(w * frac)
        if fw >= 2:
            fx = self.mx((x + w - fw, y, fw, h))[0]
            self.draw.rounded_rectangle(box(fx, fx + fw), radius=2 * SCALE, fill=color)

    def icon(self, name, x, y, color=DIM):
        """One of the face's icons (ICONS), as the watch draws its PNG."""
        self.paste_lucide(ICONS[name], x, y, color)

    def grid(self, cells):
        for c, b in zip(cells, self.L["prayers"]):
            self.label(b["name"], c["name"], GOLD if c["on"] else DIM)
            self.label(b["time"], c["time"], GOLD if c["on"] else WHITE, system=True)

    def paste_lucide(self, name, x, y, color=DIM):
        im = lucide_image(name, self.dev.icon, color)
        self.im.alpha_composite(im, ((x - self.ox) * SCALE, (y - self.oy) * SCALE))

    def paste_image(self, path, x, y):
        """An asset PNG at its own size, as the watch's IMG widget draws it."""
        im = Image.open(path).convert("RGBA")
        im = im.resize((im.width * SCALE, im.height * SCALE), Image.LANCZOS)
        self.im.alpha_composite(im, ((x - self.ox) * SCALE, (y - self.oy) * SCALE))

    def complication(self, slot, kind, value):
        """Extras cell: icon first in reading order, then the value (weather: the condition's icon and
        the temperature, both drawn by the firmware on the watch)."""
        c = self.L["comps"][slot]
        if kind == "none":
            return
        ix, iy, _, _ = self.mx(c["icon"])
        if kind == "weather":
            self.paste_lucide(SAMPLE_WEATHER, ix, iy)
            # the temperature's digit images, centred in the value box like the firmware's
            self.text(self.mx(c["value"]), value, c["temp"]["text_size"], WHITE, system=True)
            return
        self.icon(kind, ix, iy)
        self.label(c["value"], value, WHITE, system=True)

    def image(self, size=None):
        im = self.im.resize((self.w, self.h), Image.LANCZOS)
        return im.resize(size, Image.LANCZOS) if size else im


def rounded(im, radius):
    mask = Image.new("L", im.size, 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, im.width - 1, im.height - 1], radius=radius, fill=255)
    out = im.copy()
    out.putalpha(Image.composite(out.getchannel("A"), mask, mask))
    return out
