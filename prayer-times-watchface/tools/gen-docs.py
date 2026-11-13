"""Renders README screenshots from the face's real layout and logic (tools/docs-data.mjs).

Writes ../docs/watchface/pages.png (the three pages + always-on display), countdown.png
(countdown line states) and menu.png (settings menu screens, from tools/docs-menu.mjs, which runs
the real menu code on stub @zos modules); pages-en.png and menu-en.png show the mirrored
left-to-right layout in English. They show the first devices.json target. They live outside this folder so zeus doesn't pack them into the .zab. Run: python3 -I tools/gen-docs.py (via `mise run :gen`).
"""
import json
import subprocess
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))  # -I drops the script dir
from PIL import Image, ImageDraw  # noqa: E402

from render import AOD, DIM, GOLD, NIGHT, ORANGE, RED, ROOT, TEAL, WHITE, Canvas, device, rounded  # noqa: E402

DEV = device()
L = DEV.L

LANGS = {"ar": "", "en": "-en"}  # lib/i18n language → file suffix

OUT = ROOT.parent / "docs" / "watchface"  # repo-level docs/, so zeus does not pack them into the .zab
COLORS = {"teal": TEAL, "gold": GOLD, "orange": ORANGE, "night": NIGHT}
SAMPLE_EXTRAS = {True: [("weather", "٢٤°"), ("steps", "٦٢١٠"), ("battery", "٨٨٪")],
                 False: [("weather", "24°"), ("steps", "6210"), ("battery", "88%")]}
BEZEL = (58, 58, 64, 255)


def header(c, d, time, next_text, next_color, bar=None):
    c.label(L["hijri"], d["hijri"], GOLD)
    c.label(L["time"], time, WHITE, system=True)
    c.label(L["greg"], d["greg"], DIM)
    c.icon("gear", *c.mx(L["gear"])[:2])
    c.label(L["next"], next_text, next_color)
    if bar is not None:
        c.bar(bar, next_color)


def prayers(d, s):
    c = Canvas(DEV, rtl=d["rtl"])
    color = COLORS[s["color"]]
    header(c, d, s["time"], s["next"], color, s["progress"])
    c.grid(s["cells"])
    for slot, (kind, value) in enumerate(SAMPLE_EXTRAS[d["rtl"]]):
        c.complication(slot, kind, value)
    return c


def extras(d, s):  # page 2: same 3-column grid as watchface/index.js buildPages()
    c = Canvas(DEV, rtl=d["rtl"])
    header(c, d, s["time"], s["title"], DIM)
    for it, b in zip(s["items"], L["extras"]):
        c.label(b["name"], it["name"], GOLD if it["on"] else DIM)
        c.label(b["time"], it["time"], GOLD if it["on"] else WHITE, system=True)
    return c


def makruh(d, s):  # page 3: label first in reading order, then the range
    c = Canvas(DEV, rtl=d["rtl"])
    header(c, d, s["time"], s["title"], RED)
    for r, b in zip(s["rows"], L["makruh"]):
        c.label(b["label"], r["label"], RED if r["on"] else DIM)
        c.label(b["range"], r["range"], RED if r["on"] else WHITE)
    return c


def aod(d, s):  # watchface/index.js buildAod(): dim text only
    c = Canvas(DEV, rtl=d["rtl"])
    a = L["aod"]
    c.label(a["hijri"], d["hijri"], AOD)
    c.label(a["time"], s["time"], AOD, system=True)
    c.label(a["greg"], d["greg"], AOD)
    c.label(a["next"], s["next"], AOD)
    return c


def face(c, crop=None):
    """Black rounded screen with a thin bezel, on a transparent background."""
    W, H, R = DEV.w, DEV.h, DEV.radius
    im = Image.new("RGBA", (W, H), (0, 0, 0, 255))
    im.alpha_composite(c.image())
    im = rounded(im, R)
    pad = 6
    out = Image.new("RGBA", (W + pad * 2, H + pad * 2), (0, 0, 0, 0))
    ImageDraw.Draw(out).rounded_rectangle([0, 0, W + pad * 2 - 1, H + pad * 2 - 1], radius=R + pad, fill=BEZEL)
    out.alpha_composite(im, (pad, pad))
    if crop:
        out = out.crop(crop)
    return out


def menu(widgets, rtl):
    """A settings-menu screen from the widgets tools/docs-menu.mjs recorded."""
    c = Canvas(DEV, rtl=rtl)
    for w in widgets:
        if w["type"] == "IMG":
            c.paste_image(DEV.assets / w["src"], w["x"], w["y"])
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
            top = (0, 0, DEV.w + 12, L["bar"]["y"] + 13)  # down to just below the progress bar
            states = row([face(prayers(d, s[k]), top) for k in ("prayers", "urgent", "iqama", "lastThird")])
            states.save(OUT / "countdown.png", optimize=True)
            written.append("countdown.png")
    for f in written:
        im = Image.open(OUT / f)
        print(f"wrote docs/watchface/{f} {im.size} {(OUT / f).stat().st_size // 1024} KB")


if __name__ == "__main__":
    main()
