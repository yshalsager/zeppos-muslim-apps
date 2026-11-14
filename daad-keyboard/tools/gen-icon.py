"""App icon per the Zepp OS design guide: 248×248 PNG, a filled circle with a 4 px transparent
margin (no black or transparent background inside the circle). A white "ض" (Daad) over a white keyboard on blue.

Run: mise run :gen
"""
import json
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

SIZE, MARGIN, SS = 248, 4, 4  # SS = supersampling for smooth edges
BLUE, WHITE = (10, 132, 255, 255), (255, 255, 255, 255)  # BLUE matches the keyboard's popup keys
ROOT = Path(__file__).resolve().parents[2]
FONT = ROOT / ".cache" / "fonts" / "ScheherazadeNew-Medium.ttf"  # scripts/fetch-fonts.sh (SIL OFL 1.1)
APP = ROOT / "daad-keyboard"
STORE = ROOT / "docs" / "daad-keyboard" / "store"  # outside the app, so zeus doesn't pack it
TARGETS = json.loads((APP / "app.json").read_text())["targets"]  # same icon for every target


def main():
    s = SIZE * SS
    im = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    m = MARGIN * SS
    d.ellipse([m, m, s - m, s - m], fill=BLUE)
    # keyboard: white body with blue key holes (3 rows) and a space bar
    x0, x1, y0, y1 = s * 0.2, s * 0.8, s * 0.56, s * 0.8
    d.rounded_rectangle([x0, y0, x1, y1], radius=s * 0.04, fill=WHITE)
    pad, cols = s * 0.03, 6
    kw = (x1 - x0 - pad * (cols + 1)) / cols
    kh = (y1 - y0 - pad * 4) / 3
    for r in range(2):
        for c in range(cols):
            kx, ky = x0 + pad + c * (kw + pad), y0 + pad + r * (kh + pad)
            d.rounded_rectangle([kx, ky, kx + kw, ky + kh], radius=s * 0.008, fill=BLUE)
    sy = y0 + pad + 2 * (kh + pad)
    d.rounded_rectangle([x0 + pad + kw + pad, sy, x1 - pad - kw - pad, sy + kh], radius=s * 0.008, fill=BLUE)
    # A lone letter needs no shaping: Pillow draws the isolated form.
    # Placed by its ink box so the tail clears the keyboard.
    font = ImageFont.truetype(str(FONT), int(s * 0.42))
    l, t, r, b = d.textbbox((0, 0), "ض", font=font)
    gap, top = s * 0.04, s * 0.16
    assert b - t <= y0 - gap - top, "letter too tall for the space above the keyboard"
    d.text((s / 2 - (l + r) / 2, y0 - gap - b), "ض", font=font, fill=WHITE)
    im = im.resize((SIZE, SIZE), Image.LANCZOS)
    for t in TARGETS:
        im.save(APP / "assets" / t / "icon.png")
    print(f"wrote icon.png {SIZE}x{SIZE} for {', '.join(TARGETS)}")
    # the store form's icon: 240 × 240, the circle touching the edges (docs.zepp.com/docs/distribute/#application-icon)
    STORE.mkdir(parents=True, exist_ok=True)
    im.crop((MARGIN, MARGIN, SIZE - MARGIN, SIZE - MARGIN)).save(STORE / "icon.png", optimize=True)
    print(f"wrote docs/daad-keyboard/store/icon.png {SIZE - 2 * MARGIN}x{SIZE - 2 * MARGIN}")


if __name__ == "__main__":
    main()
