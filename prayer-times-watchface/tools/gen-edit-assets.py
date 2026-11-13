"""Generates watchface edit-mode assets and lib/edit-options.js from one definition.

Run: python3 -I tools/gen-edit-assets.py

Each slot sits on the face element it changes, and each option's preview is that element
rendered with the option applied (sample data from tools/preview-data.mjs), so the edit
screen looks like the face itself. Previews come in two directions: right-to-left (Arabic) and
mirrored left-to-right for the other languages; watchface/index.js picks one set when it loads.
Option titles are lib/i18n edit keys, translated on the watch.
"""
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))  # -I drops the script dir
from PIL import Image, ImageDraw  # noqa: E402

from render import (CLOCK, COMP_H, COMP_W, COMP_X, COMP_Y, DIM, ROOT, TEAL, WHITE,  # noqa: E402
                    Canvas, digit_image, icon_image, mirror, sample_data)

ASSETS = ROOT / "assets" / "bip-max" / "edit"
TYPE_BASE = 100000  # custom edit types must be >= 0x186a0
TIPS_W = 220  # tips label width; option titles must fit in it

COMP_KINDS = ["weather", "steps", "heart", "battery", "flame", "none"]
# Samples per direction. Left-to-right previews serve several languages, so they carry no words:
# the weather cell shows only the temperature, and "none" a dash.
COMP_SAMPLES = {
    "rtl": {"weather": ("٢٤°", "غائم"), "steps": "٦٢١٠", "heart": "٧٢", "battery": "٨٨٪", "flame": "٣٢٠", "none": "بدون"},
    "ltr": {"weather": ("24°", ""), "steps": "6210", "heart": "72", "battery": "88%", "flame": "320", "none": "—"},
}
DIRS = ("rtl", "ltr")


def draw_comp(c, slot, kind, d):
    sample = COMP_SAMPLES["rtl" if c.rtl else "ltr"][kind]
    if kind == "none":  # visible in the edit screen only; the face leaves the cell empty
        c.text(c.mx((COMP_X[slot], COMP_Y, COMP_W, COMP_H)), sample, 20, DIM)
    else:
        c.complication(slot, kind, sample)


# label = lib/i18n edit key for the title the watch shows on the focused slot (system font)
# default = {direction: value}; shared: previews are the same for every slot of that size, so one set
GROUPS = [
    {
        # just around the clock digits (the widest time, e.g. 12:58, fits): previews are ~w*h bytes each.
        # Arabic digits by default for Arabic, Latin for the other languages.
        "key": "arabicDigits", "editId": 102, "rect": (71, 94, 290, 96), "default": {"rtl": True, "ltr": False},
        "options": [(True, "arabicDigits"), (False, "latinDigits")], "mirrored": False,
        "draw": lambda c, v, d: c.text(CLOCK[0], d["edit"]["clock"]["arabic" if v else "latin"], CLOCK[1], WHITE, system=True),
    },
] + [
    # Extras row: three cells, each picks a metric. Weather stays blank when there's no data.
    {
        "key": f"comp{slot}", "editId": 110 + slot, "rect": (COMP_X[slot], COMP_Y, COMP_W, COMP_H),
        "default": {"rtl": default, "ltr": default}, "mirrored": True, "shared": "comp",
        "options": [(k, k) for k in COMP_KINDS],
        "draw": (lambda slot: lambda c, v, d: draw_comp(c, slot, v, d))(slot),
    }
    for slot, default in enumerate(["weather", "steps", "battery"])
]


def gen_runtime_assets():
    """Icons for the extras row and digit images for the system-drawn current temperature."""
    icons = ROOT / "assets" / "bip-max" / "icons"
    icons.mkdir(parents=True, exist_ok=True)
    for name in ["heart", "battery", "steps", "flame", "gear"]:
        icon_image(name).save(icons / f"{name}.png")
    wnum = ROOT / "assets" / "bip-max" / "wnum"
    wnum.mkdir(parents=True, exist_ok=True)
    for i in range(10):
        digit_image("٠١٢٣٤٥٦٧٨٩"[i], 26).save(wnum / f"ar_{i}.png")
        digit_image(str(i), 26).save(wnum / f"la_{i}.png")
    digit_image("°", 26).save(wnum / "deg.png")
    digit_image("-", 26).save(wnum / "minus.png")
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
        # Focus frames depend only on the slot size, so slots of the same size share one (images are
        # stored uncompressed on the watch: ~w*h bytes each). Unfocused slots get no outline: one
        # tiny transparent image for all (8x32: zeus leaves very small images unconverted).
        sel, unsel = f"frame_{w}x{h}_select.png", "frame_none.png"
        if not (ASSETS / sel).exists():
            frame(w, h, TEAL + (255,), 3).save(ASSETS / sel)
        if not (ASSETS / unsel).exists():
            Image.new("RGBA", (8, 32), (0, 0, 0, 0)).save(ASSETS / unsel)
        opts = []
        for oi, (value, label) in enumerate(g["options"]):
            preview = {}
            for d in DIRS:
                if not g["mirrored"] and d == "ltr":  # symmetric: one preview for both
                    preview[d] = preview["rtl"]
                    continue
                name = f"{g['shared']}_{value}_{d}.png" if "shared" in g else f"g{gi}_opt{oi}.png"
                preview[d] = f"edit/{name}"
                if not (ASSETS / name).exists():  # a shared preview is drawn once, for the first slot
                    canvas = Canvas(*mirror(g["rect"], d == "rtl"), rtl=d == "rtl")
                    g["draw"](canvas, value, data)
                    canvas.image().save(ASSETS / name)
            opts.append({"type": TYPE_BASE + g["editId"] * 100 + oi, "value": value, "label": label, "preview": preview})
        default_type = {d: next(o["type"] for o in opts if o["value"] == g["default"][d]) for d in DIRS}
        out_groups.append({
            "key": g["key"], "editId": g["editId"], "rect": list(g["rect"]), "tipsW": TIPS_W,
            "defaultType": default_type, "options": opts,
            "select": f"edit/{sel}", "unselect": f"edit/{unsel}",
        })

    gen_runtime_assets()

    # Settings menu (watchface/menu.js) ▲ / ▼ arrows; tap areas are invisible FILL_RECTs, no images
    # back points right: the way out in right-to-left reading; back-ltr points left
    for name, size, pts in (("up", (32, 18), [(0, 18), (16, 0), (32, 18)]), ("down", (32, 18), [(0, 0), (16, 18), (32, 0)]),
                            ("back", (18, 32), [(0, 0), (18, 16), (0, 32)]), ("back-ltr", (18, 32), [(18, 0), (0, 16), (18, 32)])):
        im = Image.new("RGBA", size, (0, 0, 0, 0))
        ImageDraw.Draw(im).polygon(pts, fill=TEAL + (255,))
        im.save(ROOT / "assets" / "bip-max" / f"arrow-{name}.png")

    tip = Image.new("RGBA", (TIPS_W, 40), (0, 0, 0, 0))
    ImageDraw.Draw(tip).rounded_rectangle([0, 0, TIPS_W - 1, 39], radius=20, fill=TEAL + (255,))
    tip.save(ASSETS / "tips_bg.png")

    js = ("// GENERATED by tools/gen-edit-assets.py. Do not edit.\n"
          f"export const EDIT_GROUPS = {json.dumps(out_groups, ensure_ascii=False, indent=2)}\n")
    (ROOT / "lib" / "edit-options.js").write_text(js)
    print(f"wrote {len(out_groups)} groups to {ASSETS.relative_to(ROOT)} and lib/edit-options.js")


if __name__ == "__main__":
    main()
