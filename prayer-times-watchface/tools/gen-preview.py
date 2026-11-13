"""Renders each target's watchface preview (also its icon) from lib/layout.js, at its devices.json
picker preview size.

Run: python3 -I tools/gen-preview.py
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))  # -I drops the script dir
from PIL import Image  # noqa: E402

from render import DIM, GOLD, ROOT, TARGETS, TEAL, WHITE, Canvas, device, rounded, sample_data  # noqa: E402


def preview(dev, d):
    c = Canvas(dev)
    L = dev.L
    c.label(L["hijri"], d["hijri"], GOLD)
    c.label(L["time"], d["time"], WHITE, system=True)
    c.label(L["greg"], d["greg"], DIM)
    c.icon("gear", L["gear"]["x"], L["gear"]["y"])
    c.label(L["next"], d["next"], TEAL)
    c.bar(d["progress"], TEAL)
    c.grid(d["cells"])
    # default extras row (gen-edit-assets.py defaults: weather, steps, battery)
    c.complication(0, "weather", "٢٤°")
    c.complication(1, "steps", "٦٢١٠")
    c.complication(2, "battery", "٨٨٪")
    face = Image.new("RGBA", (dev.w, dev.h), (0, 0, 0, 255))
    face.alpha_composite(c.image())
    return rounded(face, dev.radius).resize(dev.preview, Image.LANCZOS)


def main():
    d = sample_data()
    for target in TARGETS:
        dev = device(target)
        dest = dev.assets / "icon.png"
        out = preview(dev, d)
        out.save(dest)
        print(f"wrote {dest.relative_to(ROOT)} {out.size}")


if __name__ == "__main__":
    main()
