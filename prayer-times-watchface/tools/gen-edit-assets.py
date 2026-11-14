"""Generates the edit-mode assets, runtime icons and digit images for every devices.json target, and
lib/edit-options.js and lib/weather-icons.js (shared by all targets) from one definition.

Run: python3 -I tools/gen-edit-assets.py

Each slot sits on the face element it changes (a lib/layout.js area, so it fits each screen), and
each option's preview is that element rendered with the option applied (sample data from
tools/preview-data.mjs), so the edit screen looks like the face itself. Previews come in two
directions: right-to-left (Arabic) and mirrored left-to-right for the other languages;
watchface/index.js picks one set when it loads. Option titles are lib/i18n edit keys, translated on
the watch. Asset names are the same for every target, so the generated lib/ files are too.
"""
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))  # -I drops the script dir
from PIL import Image, ImageDraw  # noqa: E402

from render import (DIM, ROOT, TARGETS, TEAL, WEATHER_ICONS, WHITE,  # noqa: E402
                    Canvas, device, digit_image, icon_image, lucide_image, mirror, rect, sample_data)

TYPE_BASE = 100000  # custom edit types must be >= 0x186a0

COMP_KINDS = ["weather", "steps", "heart", "battery", "flame", "none"]
# Samples per direction. Left-to-right previews serve several languages, so they carry no words
# ("none" is a dash).
COMP_SAMPLES = {
    "rtl": {"weather": "٢٤°", "steps": "٦٢١٠", "heart": "٧٢", "battery": "٨٨٪", "flame": "٣٢٠", "none": "بدون"},
    "ltr": {"weather": "24°", "steps": "6210", "heart": "72", "battery": "88%", "flame": "320", "none": "—"},
}
DIRS = ("rtl", "ltr")


def draw_comp(c, slot, kind, d):
    sample = COMP_SAMPLES["rtl" if c.rtl else "ltr"][kind]
    if kind == "none":  # visible in the edit screen only; the face leaves the cell empty
        c.label(c.L["comps"][slot]["cell"], sample, DIM)
    else:
        c.complication(slot, kind, sample)


# area = the lib/layout.js box the slot sits on: "digits" (editDigits) or "comp" (comps[slot].cell)
# label = lib/i18n edit key for the title the watch shows on the focused slot (system font)
# default = {direction: value}; shared: previews are the same for every slot of that size, so one set
GROUPS = [
    {
        # just around the clock digits: previews are ~w*h bytes each.
        # Arabic digits by default for Arabic, Latin for the other languages.
        "key": "arabicDigits", "editId": 102, "area": "digits", "default": {"rtl": True, "ltr": False},
        "options": [(True, "arabicDigits"), (False, "latinDigits")], "mirrored": False,
        "draw": lambda c, v, d: c.label(c.L["time"], d["edit"]["clock"]["arabic" if v else "latin"], WHITE, system=True),
    },
] + [
    # Extras row: three cells, each picks a metric. Weather stays blank when there's no data.
    {
        "key": f"comp{slot}", "editId": 110 + slot, "area": "comp", "slot": slot,
        "default": {"rtl": default, "ltr": default}, "mirrored": True, "shared": "comp",
        "options": [(k, k) for k in COMP_KINDS],
        "draw": (lambda slot: lambda c, v, d: draw_comp(c, slot, v, d))(slot),
    }
    for slot, default in enumerate(["weather", "steps", "battery"])
]


def area(dev, g):
    return rect(dev.L["editDigits"] if g["area"] == "digits" else dev.L["comps"][g["slot"]]["cell"])


def gen_runtime_assets(dev):
    """Icons for the extras row, weather icons and digit images for the system-drawn current weather."""
    icons = dev.assets / "icons"
    icons.mkdir(parents=True, exist_ok=True)
    for name in ["heart", "battery", "steps", "flame", "gear"]:
        icon_image(name, dev.icon).save(icons / f"{name}.png")
    weather = dev.assets / "weather"
    weather.mkdir(parents=True, exist_ok=True)
    for old in weather.glob("*.png"):
        old.unlink()
    for name in sorted({n for n in WEATHER_ICONS if n}):
        lucide_image(name, dev.icon, scale=1).save(weather / f"{name}.png")
    Image.new("RGBA", (dev.icon, dev.icon), (0, 0, 0, 0)).save(weather / "none.png")  # unknown weather
    wnum = dev.assets / "wnum"
    wnum.mkdir(parents=True, exist_ok=True)
    size = dev.L["comps"][0]["temp"]["text_size"]
    for i in range(10):
        digit_image("٠١٢٣٤٥٦٧٨٩"[i], size).save(wnum / f"ar_{i}.png")
        digit_image(str(i), size).save(wnum / f"la_{i}.png")
    digit_image("°", size).save(wnum / "deg.png")
    digit_image("-", size).save(wnum / "minus.png")
    # no weather data → nothing; digit-sized because zeus skips converting tiny images (stays raw PNG)
    Image.new("RGBA", (8, 32), (0, 0, 0, 0)).save(wnum / "none.png")


def frame(w, h, color, width, radius):
    im = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    ImageDraw.Draw(im).rounded_rectangle([0, 0, w - 1, h - 1], radius=radius, outline=color, width=width)
    return im


def arrows(dev):
    """Settings menu (watchface/menu.js) arrows, at the layout's sizes (tap areas are IMGs
    without an image). back points right: the way out in right-to-left reading; back-ltr left."""
    M = dev.L["menu"]
    shapes = {"up": (M["up"], [(0, 1), (0.5, 0), (1, 1)]), "down": (M["down"], [(0, 0), (0.5, 1), (1, 0)]),
              "back": (M["back"], [(0, 0), (1, 0.5), (0, 1)]), "back-ltr": (M["back"], [(1, 0), (0, 0.5), (1, 1)])}
    for name, (b, pts) in shapes.items():
        w, h = b["w"], b["h"]
        im = Image.new("RGBA", (w, h), (0, 0, 0, 0))
        for x, y in triangle_pixels(w, h, pts):
            im.putpixel((x, y), TEAL + (255,))
        im.save(dev.assets / f"arrow-{name}.png")


def triangle_pixels(w, h, pts):
    """Pixels of a w x h image whose centres lie inside (or on) the triangle pts (corners as 0, 0.5 or 1
    of w and h). Exact integer maths in half-pixel units: Pillow's polygon fill rounds edge pixels
    differently on arm64 and x86_64."""
    P = [(round(px * 2 * w), round(py * 2 * h)) for px, py in pts]
    out = []
    for y in range(h):
        for x in range(w):
            cx, cy = 2 * x + 1, 2 * y + 1
            c = [(bx - ax) * (cy - ay) - (by - ay) * (cx - ax) for (ax, ay), (bx, by) in zip(P, P[1:] + P[:1])]
            if all(v >= 0 for v in c) or all(v <= 0 for v in c):
                out.append((x, y))
    return out


def gen_edit(dev, data):
    """The target's edit/ folder; returns lib/edit-options.js's groups (the same for every target)."""
    out = dev.assets / "edit"
    out.mkdir(parents=True, exist_ok=True)
    for old in out.glob("*.png"):
        old.unlink()
    # Unfocused slots get no outline: one tiny transparent image for all (8x32: zeus leaves very
    # small images unconverted). Images are stored uncompressed on the watch: ~w*h bytes each.
    Image.new("RGBA", (8, 32), (0, 0, 0, 0)).save(out / "frame_none.png")
    groups = []
    for gi, g in enumerate(GROUPS, start=1):
        box = area(dev, g)
        # Focus frames depend only on the slot's area, so the three extras cells share one.
        sel = f"frame_{g['area']}_select.png"
        if not (out / sel).exists():
            frame(box[2], box[3], TEAL + (255,), 3, dev.L["menu"]["radius"]).save(out / sel)
        opts = []
        for oi, (value, label) in enumerate(g["options"]):
            preview = {}
            for d in DIRS:
                if not g["mirrored"] and d == "ltr":  # symmetric: one preview for both
                    preview[d] = preview["rtl"]
                    continue
                name = f"{g['shared']}_{value}_{d}.png" if "shared" in g else f"g{gi}_opt{oi}.png"
                preview[d] = f"edit/{name}"
                if not (out / name).exists():  # a shared preview is drawn once, for the first slot
                    canvas = Canvas(dev, *mirror(box, d == "rtl", dev.w), rtl=d == "rtl")
                    g["draw"](canvas, value, data)
                    canvas.image().save(out / name)
            opts.append({"type": TYPE_BASE + g["editId"] * 100 + oi, "value": value, "label": label, "preview": preview})
        default_type = {d: next(o["type"] for o in opts if o["value"] == g["default"][d]) for d in DIRS}
        groups.append({
            "key": g["key"], "editId": g["editId"], "area": g["area"], **({"slot": g["slot"]} if "slot" in g else {}),
            "defaultType": default_type, "options": opts,
            "select": f"edit/{sel}", "unselect": "edit/frame_none.png",
        })
    tw, th = dev.L["tips"]["w"], dev.L["tips"]["h"]
    tip = Image.new("RGBA", (tw, th), (0, 0, 0, 0))
    ImageDraw.Draw(tip).rounded_rectangle([0, 0, tw - 1, th - 1], radius=th // 2, fill=TEAL + (255,))
    tip.save(out / "tips_bg.png")
    return groups


def main():
    data = sample_data()
    groups = None
    for target in TARGETS:
        dev = device(target)
        groups = gen_edit(dev, data)
        gen_runtime_assets(dev)
        arrows(dev)
        print(f"wrote {len(groups)} edit groups and runtime images to {dev.assets.relative_to(ROOT)}")
    js = ("// GENERATED by tools/gen-edit-assets.py. Do not edit.\n"
          f"export const EDIT_GROUPS = {json.dumps(groups, ensure_ascii=False, indent=2)}\n")
    (ROOT / "lib" / "edit-options.js").write_text(js)
    js = ("// GENERATED by tools/gen-edit-assets.py. Do not edit.\n"
          "// Weather icon per Zepp weather code 0–28, for IMG_LEVEL + data_type.WEATHER (Lucide, ISC)\n"
          f"export const WEATHER_ICONS = {json.dumps(['weather/%s.png' % (n or 'none') for n in WEATHER_ICONS], indent=2)}\n")
    (ROOT / "lib" / "weather-icons.js").write_text(js)
    print("wrote lib/edit-options.js and lib/weather-icons.js")


if __name__ == "__main__":
    main()
