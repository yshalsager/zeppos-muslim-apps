"""App icon per the Zepp OS design guide: 248×248 PNG, a filled circle with a 4 px transparent
margin (no black or transparent background inside the circle). A white location pin on teal.

Run: uv run --no-project --with pillow python3 -I tools/gen-icon.py
"""
from pathlib import Path

from PIL import Image, ImageDraw

SIZE, MARGIN, SS = 248, 4, 4  # SS = supersampling for smooth edges
TEAL, WHITE = (13, 148, 136, 255), (255, 255, 255, 255)
OUT = Path(__file__).resolve().parent.parent / "assets" / "bip-max" / "icon.png"


def main():
    s = SIZE * SS
    im = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    m = MARGIN * SS
    d.ellipse([m, m, s - m, s - m], fill=TEAL)
    # pin: circle head + triangle tail, with a teal hole
    cx, cy, r = s / 2, s * 0.42, s * 0.2
    d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=WHITE)
    d.polygon([(cx - r * 0.86, cy + r * 0.5), (cx + r * 0.86, cy + r * 0.5), (cx, s * 0.8)], fill=WHITE)
    h = r * 0.42
    d.ellipse([cx - h, cy - h, cx + h, cy + h], fill=TEAL)
    im.resize((SIZE, SIZE), Image.LANCZOS).save(OUT)
    print(f"wrote {OUT.name} {SIZE}x{SIZE}")


if __name__ == "__main__":
    main()
