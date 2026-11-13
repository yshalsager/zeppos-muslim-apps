"""Renders the watchface preview (also its icon) from the layout in watchface/index.js.

Run: python3 -I tools/gen-preview.py
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))  # -I drops the script dir
from PIL import Image  # noqa: E402

from render import CLOCK, DIM, GEAR, GOLD, GREG, H, HIJRI, NEXT, RADIUS, ROOT, TEAL, W, WHITE, Canvas, rounded, sample_data  # noqa: E402

PREVIEW = (294, 350)  # Bip Max watchface preview size (Zepp device list)


def main():
    d = sample_data()
    c = Canvas()
    c.text(HIJRI[0], d["hijri"], HIJRI[1], GOLD)
    c.text(CLOCK[0], d["time"], CLOCK[1], WHITE, system=True)
    c.text(GREG[0], d["greg"], GREG[1], DIM)
    c.icon("gear", *GEAR[:2])
    c.text(NEXT[0], d["next"], NEXT[1], TEAL)
    c.bar(d["progress"], TEAL)
    c.grid(d["cells"])
    # default extras row (gen-edit-assets.py defaults: weather, steps, battery)
    c.complication(0, "weather", "٢٤°")
    c.complication(1, "steps", "٦٢١٠")
    c.complication(2, "battery", "٨٨٪")

    face = Image.new("RGBA", (W, H), (0, 0, 0, 255))
    face.alpha_composite(c.image())
    out = rounded(face, RADIUS).resize(PREVIEW, Image.LANCZOS)
    dest = ROOT / "assets" / "bip-max" / "icon.png"
    out.save(dest)
    print(f"wrote {dest.relative_to(ROOT)} {out.size}")


if __name__ == "__main__":
    main()
