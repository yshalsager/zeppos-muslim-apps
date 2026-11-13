"""Renders README screenshots from the face's real layout and logic (tools/docs-data.mjs).

Writes ../docs/watchface/pages.png (the three pages + always-on display), countdown.png
(countdown line states) and menu.png (settings menu screens, from tools/docs-menu.mjs, which runs
the real menu code on stub @zos modules); pages-en.png and menu-en.png show the mirrored
left-to-right layout in English. They live outside this folder so zeus doesn't pack them into the .zab. Run: python3 -I tools/gen-docs.py (via `mise run :gen`).
"""
import json
import subprocess
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))  # -I drops the script dir
from PIL import Image, ImageDraw  # noqa: E402

from render import (AOD, CLOCK, DIM, GEAR, GOLD, GREG, HIJRI, NEXT, NIGHT, ORANGE, RADIUS, RED, ROOT, TEAL,  # noqa: E402
                    WHITE, H, W, Canvas, grid_x, rounded)

LANGS = {"ar": "", "en": "-en"}  # lib/i18n language → file suffix

OUT = ROOT.parent / "docs" / "watchface"  # repo-level docs/, so zeus does not pack them into the .zab
COLORS = {"teal": TEAL, "gold": GOLD, "orange": ORANGE, "night": NIGHT}
SAMPLE_EXTRAS = {True: [("weather", "٢٤°"), ("steps", "٦٢١٠"), ("battery", "٨٨٪")],
                 False: [("weather", "24°"), ("steps", "6210"), ("battery", "88%")]}
BEZEL = (58, 58, 64, 255)


def header(c, d, time, next_text, next_color, bar=None):
    c.text(HIJRI[0], d["hijri"], HIJRI[1], GOLD)
    c.text(CLOCK[0], time, CLOCK[1], WHITE, system=True)
    c.text(GREG[0], d["greg"], GREG[1], DIM)
    c.icon("gear", *c.mx(GEAR)[:2])
    c.text(NEXT[0], next_text, NEXT[1], next_color)
    if bar is not None:
        c.bar(bar, next_color)


def prayers(d, s):
    c = Canvas(rtl=d["rtl"])
    color = COLORS[s["color"]]
    header(c, d, s["time"], s["next"], color, s["progress"])
    c.grid(s["cells"])
    for slot, (kind, value) in enumerate(SAMPLE_EXTRAS[d["rtl"]]):
        c.complication(slot, kind, value)
    return c


def extras(d, s):  # page 2: same 3-column grid as watchface/index.js buildPages()
    c = Canvas(rtl=d["rtl"])
    header(c, d, s["time"], s["title"], DIM)
    for i, it in enumerate(s["items"]):
        x, y = grid_x(i % 3), 294 + (i // 3) * 70
        c.text(c.mx((x, y, 132, 28)), it["name"], 19, GOLD if it["on"] else DIM)
        c.text(c.mx((x, y + 26, 132, 38)), it["time"], 30, GOLD if it["on"] else WHITE, system=True)
    return c


def makruh(d, s):  # page 3: label first in reading order, then the range
    c = Canvas(rtl=d["rtl"])
    header(c, d, s["time"], s["title"], RED)
    for i, r in enumerate(s["rows"]):
        y = 296 + i * 42
        c.text(c.mx((236, y, 176, 40)), r["label"], 26, RED if r["on"] else DIM)
        c.text(c.mx((20, y, 216, 40)), r["range"], 28, RED if r["on"] else WHITE)
    return c


def aod(d, s):  # watchface/index.js buildAod(): dim text only
    c = Canvas(rtl=d["rtl"])
    c.text((16, 84, W - 32, 44), d["hijri"], 30, AOD)
    c.text((0, 130, W, 120), s["time"], 112, AOD, system=True)
    c.text((16, 248, W - 32, 36), d["greg"], 26, AOD)
    c.text((16, 292, W - 32, 44), s["next"], 30, AOD)
    return c


def face(c, crop=None):
    """Black rounded screen with a thin bezel, on a transparent background."""
    im = Image.new("RGBA", (W, H), (0, 0, 0, 255))
    im.alpha_composite(c.image())
    im = rounded(im, RADIUS)
    pad = 6
    out = Image.new("RGBA", (W + pad * 2, H + pad * 2), (0, 0, 0, 0))
    ImageDraw.Draw(out).rounded_rectangle([0, 0, W + pad * 2 - 1, H + pad * 2 - 1], radius=RADIUS + pad, fill=BEZEL)
    out.alpha_composite(im, (pad, pad))
    if crop:
        out = out.crop(crop)
    return out


def menu(widgets, rtl):
    """A settings-menu screen from the widgets tools/docs-menu.mjs recorded."""
    c = Canvas(rtl=rtl)
    for w in widgets:
        if w["type"] == "IMG":
            c.paste_image(ROOT / "assets" / "bip-max" / w["src"], w["x"], w["y"])
        elif w["type"] == "TEXT" and w.get("text"):
            s = w["text"]
            system = not w.get("font")
            color = w.get("color", 0xFFFFFF)
            c.text((w["x"], w["y"], w["w"], w["h"]), s, w["size"], (color >> 16, (color >> 8) & 255, color & 255),
                   system=system, ltr=s[0] in "+-")
    return c


def row(images, gap=28):
    w = sum(i.width for i in images) + gap * (len(images) - 1)
    out = Image.new("RGBA", (w, max(i.height for i in images)), (0, 0, 0, 0))
    x = 0
    for i in images:
        out.alpha_composite(i, (x, 0))
        x += i.width + gap
    return out


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    written = []
    for lang, suffix in LANGS.items():
        d = json.loads(subprocess.check_output(["node", str(ROOT / "tools" / "docs-data.mjs"), lang], cwd=ROOT))
        s = d["scenes"]
        pages = row([face(prayers(d, s["prayers"])), face(extras(d, s["extras"])),
                     face(makruh(d, s["makruh"])), face(aod(d, s["aod"]))])
        pages.save(OUT / f"pages{suffix}.png", optimize=True)
        screens = json.loads(subprocess.check_output(
            ["node", "--import", "./tools/zos-stub/register.mjs", str(ROOT / "tools" / "docs-menu.mjs"), lang], cwd=ROOT))
        row([face(menu(screens[k], d["rtl"])) for k in ("root", "method", "value", "index")]).save(OUT / f"menu{suffix}.png", optimize=True)
        written += [f"pages{suffix}.png", f"menu{suffix}.png"]
        if lang == "ar":
            # countdown states: top part of the face (date, clock, countdown line, progress bar)
            top = (0, 0, W + 12, 300)
            states = row([face(prayers(d, s[k]), top) for k in ("prayers", "urgent", "iqama", "lastThird")])
            states.save(OUT / "countdown.png", optimize=True)
            written.append("countdown.png")
    for f in written:
        im = Image.open(OUT / f)
        print(f"wrote docs/watchface/{f} {im.size} {(OUT / f).stat().st_size // 1024} KB")


if __name__ == "__main__":
    main()
