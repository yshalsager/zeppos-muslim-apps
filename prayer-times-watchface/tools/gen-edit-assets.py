"""Generates watchface edit-mode assets and lib/edit-options.js from one definition.

Run: python3 -I tools/gen-edit-assets.py

Each slot sits on the face element it changes, and each option's preview is that element
rendered with the option applied (sample data from tools/preview-data.mjs), so the edit
screen looks like the face itself.
"""
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))  # -I drops the script dir
from PIL import Image, ImageDraw  # noqa: E402

from render import (CLOCK, COMP_H, COMP_W, COMP_X, COMP_Y, DIM, GREG, HIJRI, NEXT, ROOT, TEAL, GOLD, WHITE,  # noqa: E402
                    Canvas, digit_image, icon_image, sample_data)

ASSETS = ROOT / "assets" / "bip-max" / "edit"
TYPE_BASE = 100000  # custom edit types must be >= 0x186a0
TIPS_W = 220  # tips label width; option titles must fit in it

GRID_RECT = (16, 292, 400, 144)  # the 2x3 prayer grid
GREG_RIGHT = (218, 196, 198, 40)  # Gregorian line split in two: right half = extra Fajr
GREG_LEFT = (16, 196, 198, 40)  # left half = extra Isha
FAJR_ANGLES = [18, 17, 16, 15, 14.6, 14, 13, 12]
ISHA_ANGLES = [18, 17, 16, 15, 14, 13, 12]


AR_DIGITS = "٠١٢٣٤٥٦٧٨٩"


def ar(n):
    return "".join(AR_DIGITS[int(ch)] if ch.isdigit() else ch for ch in str(n))


COMP_KINDS = ["weather", "steps", "heart", "battery", "flame", "none"]
COMP_TITLES = {"weather": "الطقس", "steps": "الخطوات", "heart": "النبض", "battery": "البطارية",
               "flame": "السعرات", "none": "بدون"}
COMP_SAMPLES = {"weather": ("٢٤°", "غائم"), "steps": "٦٢١٠", "heart": "٧٢", "battery": "٨٨٪", "flame": "٣٢٠"}


def draw_comp(c, slot, kind):
    if kind == "none":  # visible in the edit screen only; the face leaves the cell empty
        c.text((COMP_X[slot], COMP_Y, COMP_W, COMP_H), "بدون", 20, DIM)
    else:
        c.complication(slot, kind, COMP_SAMPLES[kind])


def grow(box, dy=2):
    x, y, w, h = box
    return (x, y - dy, w, h + 2 * dy)


# title = the label the watch shows for the focused slot (system font, Arabic is fine)
GROUPS = [
    {
        # key "*": the option value is a dict merged into the settings
        "key": "*", "editId": 101, "rect": grow(HIJRI[0]),
        "default": {"hijriOffsetDays": 0, "hijriDayStartsAtMaghrib": False},
        "options": [
            ({"hijriOffsetDays": o, "hijriDayStartsAtMaghrib": mg}, label + (" (المغرب)" if mg else ""))
            for mg in (False, True)
            for o, label in [(-2, "ناقص يومين"), (-1, "ناقص يوم"), (0, "أم القرى"), (1, "زائد يوم"), (2, "زائد يومين")]
        ],
        "draw": lambda c, v, d: c.text(
            HIJRI[0],
            d["edit"]["hijri"][str(v["hijriOffsetDays"])] + (" (من المغرب)" if v["hijriDayStartsAtMaghrib"] else ""),
            HIJRI[1] - (6 if v["hijriDayStartsAtMaghrib"] else 0), GOLD),
    },
    {
        "key": "arabicDigits", "editId": 102, "rect": (16, 84, 400, 112), "default": True,
        "options": [(True, "أرقام عربية"), (False, "أرقام لاتينية")],
        "draw": lambda c, v, d: c.text(CLOCK[0], d["edit"]["clock"]["arabic" if v else "latin"], CLOCK[1], WHITE, system=True),
    },
    {
        # minutes after adhan for [fajr, dhuhr, asr, maghrib, isha]; "custom" = CONFIG.iqama
        "key": "iqama", "editId": 106, "rect": grow(NEXT[0]), "default": None,
        "options": [(None, "بدون إقامة"), ([10, 10, 10, 5, 10], "إقامة قصيرة"),
                    ([20, 15, 15, 10, 15], "إقامة معتادة"), ([30, 20, 20, 10, 20], "إقامة طويلة"),
                    ("custom", "إقامة مخصصة")],
        "draw": lambda c, v, d: c.text(NEXT[0], iqama_label(v, d), NEXT[1] - 4, TEAL),
    },
    # Extra Fajr #1 / Isha #1 (page 2): user-chosen angles, independent of the method; the face hides
    # one that equals the method's own angle. "custom" = config.js extraFajrAngle / extraIshaAngle.
    {
        "key": "extraFajrAngle", "editId": 108, "rect": GREG_RIGHT, "default": 0,
        "options": [(0, "بدون فجر إضافي")] + [(a, f"فجر {ar(a)}°") for a in FAJR_ANGLES] + [("custom", "فجر مخصص")],
        "draw": lambda c, v, d: c.text(GREG_RIGHT, extra_label("فجر", "fajr", v, d), 21, DIM),
    },
    {
        "key": "extraIshaAngle", "editId": 109, "rect": GREG_LEFT, "default": 0,
        "options": [(0, "بدون عشاء إضافي")] + [(a, f"عشاء {ar(a)}°") for a in ISHA_ANGLES] + [("custom", "عشاء مخصص")],
        "draw": lambda c, v, d: c.text(GREG_LEFT, extra_label("عشاء", "isha", v, d), 21, DIM),
    },
    {
        "key": "method", "editId": 104, "rect": GRID_RECT, "default": "egypt",
        "options": [("egypt", "الهيئة المصرية"), ("mwl", "رابطة العالم"), ("karachi", "كراتشي"),
                    ("isna", "أمريكا الشمالية"), ("makkah", "أم القرى"), ("uiof", "اتحاد فرنسا"),
                    ("dubai", "دبي"), ("kuwait", "الكويت"), ("qatar", "قطر"), ("singapore", "سنغافورة"),
                    ("turkey", "تركيا (ديانت)"), ("tehran", "طهران"), ("moonsighting", "لجنة الأهلة")],
        "draw": lambda c, v, d: c.grid(d["edit"]["grids"][v]),
    },
] + [
    # Extras row: three cells, each picks a metric. Weather stays blank when there's no data.
    {
        "key": f"comp{slot}", "editId": 110 + slot, "rect": (COMP_X[slot], COMP_Y, COMP_W, COMP_H),
        "default": default,
        "options": [(k, COMP_TITLES[k]) for k in COMP_KINDS],
        "draw": (lambda slot: lambda c, v, d: draw_comp(c, slot, v))(slot),
    }
    for slot, default in enumerate(["weather", "steps", "battery"])
]


def extra_label(name, key, v, d):
    if v == 0:
        return f"بدون {name} إضافي"
    if v == "custom":
        a = d["config"]["extraFajrAngle" if key == "fajr" else "extraIshaAngle"]
        return f"{name} مخصص {ar(a)}°" if a else f"{name} مخصص: لا يوجد"
    return f"{name} {ar(v)}°  {d['extras'][key][str(v)]}"


def iqama_label(v, d):
    if v is None:
        return "بدون إقامة"
    mins = d["config"]["iqama"] if v == "custom" else v
    nums = " ".join("".join(AR_DIGITS[int(ch)] for ch in str(n)) for n in mins)
    return ("الإقامة (مخصصة): " if v == "custom" else "الإقامة بعد: ") + nums + " د"


def gen_runtime_assets():
    """Icons for the extras row and digit images for the system-drawn current temperature."""
    icons = ROOT / "assets" / "bip-max" / "icons"
    icons.mkdir(parents=True, exist_ok=True)
    for name in ["heart", "battery", "steps", "flame"]:
        icon_image(name).save(icons / f"{name}.png")
    wnum = ROOT / "assets" / "bip-max" / "wnum"
    wnum.mkdir(parents=True, exist_ok=True)
    for i in range(10):
        digit_image("٠١٢٣٤٥٦٧٨٩"[i], 26).save(wnum / f"ar_{i}.png")
        digit_image(str(i), 26).save(wnum / f"la_{i}.png")
    digit_image("°", 26).save(wnum / "deg.png")
    digit_image("-", 26).save(wnum / "minus.png")  # Latin font: SF Arabic has no hyphen
    # no weather data → nothing; digit-sized because zeus skips converting tiny images (stays raw PNG)
    Image.new("RGBA", (8, 32), (0, 0, 0, 0)).save(wnum / "none.png")


def frame(w, h, color, width):
    im = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    ImageDraw.Draw(im).rounded_rectangle([0, 0, w - 1, h - 1], radius=14, outline=color, width=width)
    return im


def main():
    data = sample_data()
    ASSETS.mkdir(parents=True, exist_ok=True)
    for old in ASSETS.glob("*.png"):
        old.unlink()

    out_groups = []
    for gi, g in enumerate(GROUPS, start=1):
        x, y, w, h = g["rect"]
        frame(w, h, TEAL + (255,), 3).save(ASSETS / f"g{gi}_select.png")
        frame(w, h, (90, 90, 90, 255), 1).save(ASSETS / f"g{gi}_unselect.png")
        opts = []
        for oi, (value, title) in enumerate(g["options"]):
            canvas = Canvas(x, y, w, h)
            g["draw"](canvas, value, data)
            name = f"g{gi}_opt{oi}.png"
            canvas.image().save(ASSETS / name)
            opts.append({"type": TYPE_BASE + g["editId"] * 100 + oi, "value": value, "title": title,
                         "preview": f"edit/{name}"})
        default_type = next(o["type"] for o in opts if o["value"] == g["default"])
        out_groups.append({
            "key": g["key"], "editId": g["editId"], "rect": list(g["rect"]), "tipsW": TIPS_W,
            "defaultType": default_type, "options": opts,
            "select": f"edit/g{gi}_select.png", "unselect": f"edit/g{gi}_unselect.png",
        })

    gen_runtime_assets()

    # Methods offered must exist in lib/prayer.js METHODS (preview-data computes a grid per method)
    method_keys = [v for v, _ in next(g for g in GROUPS if g["key"] == "method")["options"]]
    assert sorted(method_keys) == sorted(data["edit"]["grids"]), (method_keys, list(data["edit"]["grids"]))

    # Transparent tap target for the page-cycling BUTTON over the prayer grid (watchface/index.js GRID)
    Image.new("RGBA", (400, 216), (0, 0, 0, 0)).save(ROOT / "assets" / "bip-max" / "tap.png")

    tip = Image.new("RGBA", (TIPS_W, 40), (0, 0, 0, 0))
    ImageDraw.Draw(tip).rounded_rectangle([0, 0, TIPS_W - 1, 39], radius=20, fill=TEAL + (255,))
    tip.save(ASSETS / "tips_bg.png")

    js = ("// GENERATED by tools/gen-edit-assets.py. Do not edit.\n"
          f"export const EDIT_GROUPS = {json.dumps(out_groups, ensure_ascii=False, indent=2)}\n")
    (ROOT / "lib" / "edit-options.js").write_text(js)
    print(f"wrote {len(out_groups)} groups to {ASSETS.relative_to(ROOT)} and lib/edit-options.js")


if __name__ == "__main__":
    main()
