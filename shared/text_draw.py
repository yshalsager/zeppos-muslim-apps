"""Text drawing shared by the projects' image generators (store previews, screenshots, icons).

Text is shaped by HarfBuzz (uharfbuzz) and drawn by FreeType (freetype-py), both bundled in their
wheels, so the output is the same on macOS and Linux (CI) without Pillow's libraqm or system fonts.
uax9.py puts the left-to-right and right-to-left runs of a line in visual order. Fonts come from
scripts/fetch-fonts.sh (pinned, checksum-verified) into the repo's .cache/fonts.

Generators put this folder on sys.path (python3 -I drops the script's own directory), then import it.
"""
import functools
import math
from pathlib import Path

import freetype
import uharfbuzz as hb
from PIL import Image, ImageChops

import uax9  # this folder is on sys.path

FONTS = Path(__file__).resolve().parent.parent / ".cache" / "fonts"
# Stand-ins for the watch's system font, and the source of the watchface's Naskh font
SYSTEM_ARABIC = FONTS / "NotoSansArabic.ttf"
LATIN_FONT = FONTS / "NotoSans.ttf"
SCHEHERAZADE = FONTS / "ScheherazadeNew-Medium.ttf"
SCALE = 3  # supersample for smooth text


def is_arabic(s):
    """Whether s has any Arabic-script letter (the watch then lays it out right to left)."""
    return any(0x0600 <= ord(c) <= 0x08FF or 0xFB50 <= ord(c) <= 0xFEFF for c in s)


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


def system_font(s, px):
    """The system-font stand-in for s at px: Noto Sans Arabic for Arabic script, else Noto Sans."""
    return font(SYSTEM_ARABIC if is_arabic(s) else LATIN_FONT, px)


def line(im, s, size, color, cx, cy):
    """One line in the system-font stand-in, centred on (cx, cy) like Pillow's anchor "mm"; size and
    the centre in screen pixels × SCALE (im is drawn at SCALE)."""
    rtl = is_arabic(s)
    f = system_font(s, size * SCALE)
    m, adv = f.mask(s, rtl)
    left, top = round(cx - adv / 2 - f.pad), round(cy + (f.asc + f.desc) / 2 - f.asc - f.pad)
    ink = Image.new("RGBA", m.size, tuple(color[:3]) + (255,))
    ink.putalpha(m)
    im.alpha_composite(ink, (left, top))


def wrap(s, size, width):
    """Greedy word wrap in the system-font stand-in, as the watch's text_style.WRAP; width in screen px."""
    f, rtl = system_font(s, size * SCALE), is_arabic(s)
    lines = []
    for word in s.split(" "):
        if lines and f.width(lines[-1] + " " + word, rtl) <= width * SCALE:
            lines[-1] += " " + word
        else:
            lines.append(word)
    return lines
