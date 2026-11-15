"""App icon per the Zepp OS design guide: 248×248 PNG, a filled circle with a 4 px transparent
margin. A pale-yellow crescent and two stars on night indigo.

Also the main page's icons, per target at the size lib/layout.js gives them on that screen
(tools/layout-data.mjs): icons/alarm.png (the alarm chip) and icons/gear.png, gear-press.png (the
settings button next to it), drawn from Lucide's icon font (scripts/fetch-fonts.sh; ISC licence).

Run: mise run :gen
"""
import json
import subprocess
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

SIZE, MARGIN, SS = 248, 4, 4  # SS = supersampling for smooth edges
NIGHT, MOON = (38, 35, 90, 255), (255, 214, 10, 255)  # the page's "best result" colours
APP = Path(__file__).resolve().parents[1]
DOCS = APP.parent / "docs" / "sleep-time"  # outside the app, so zeus doesn't pack it
TARGETS = json.loads((APP / "app.json").read_text())["targets"]
DEVICES = json.loads((APP.parent / "devices.json").read_text())  # each target's screen
FONTS = APP.parent / ".cache" / "fonts"
LUCIDE = json.loads((FONTS / "lucide-codepoints.json").read_text())
# lib/ui.js colours: the chip's yellow, the keys' grey and pressed grey
YELLOW, KEY, KEY_DOWN, WHITE = (255, 214, 10), (44, 44, 46), (72, 72, 74), (255, 255, 255)


def star(d, cx, cy, r):
    # a four-pointed sparkle
    w = r * 0.28
    d.polygon([(cx, cy - r), (cx + w, cy - w), (cx + r, cy), (cx + w, cy + w), (cx, cy + r), (cx - w, cy + w), (cx - r, cy), (cx - w, cy - w)], fill=MOON)


def main():
    s = SIZE * SS
    im = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    m = MARGIN * SS
    d.ellipse([m, m, s - m, s - m], fill=NIGHT)
    # crescent: a moon disc with a night disc over its upper right
    r, cx, cy = s * 0.27, s * 0.45, s * 0.53
    d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=MOON)
    ox, oy = s * 0.13, -s * 0.1
    d.ellipse([cx - r + ox, cy - r + oy, cx + r + ox, cy + r + oy], fill=NIGHT)
    star(d, s * 0.7, s * 0.3, s * 0.07)
    star(d, s * 0.76, s * 0.55, s * 0.045)
    im = im.resize((SIZE, SIZE), Image.LANCZOS)
    for t in TARGETS:
        im.save(APP / "assets" / t / "icon.png")
    print(f"wrote icon.png {SIZE}x{SIZE} for {', '.join(TARGETS)}")
    # the store form's icon: 240 × 240, the circle touching the edges (docs.zepp.com/docs/distribute/#application-icon)
    DOCS.mkdir(parents=True, exist_ok=True)
    im.crop((MARGIN, MARGIN, SIZE - MARGIN, SIZE - MARGIN)).save(DOCS / "icon.png", optimize=True)
    print(f"wrote docs/sleep-time/icon.png {SIZE - 2 * MARGIN}x{SIZE - 2 * MARGIN}")


def glyph(name, size, color, background=None):
    """A Lucide icon centred in a size × size image, on a filled circle if background is given."""
    s = size * SS
    im = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    if background:
        d.ellipse([0, 0, s - 1, s - 1], fill=background)
    font = ImageFont.truetype(str(FONTS / "lucide.ttf"), int(s * (0.55 if background else 1)))
    d.text((s / 2, s / 2), chr(LUCIDE[name]), font=font, fill=color, anchor="mm")
    return im.resize((size, size), Image.LANCZOS)


def icons():
    for t in TARGETS:
        w, h = DEVICES[t]["width"], DEVICES[t]["height"]
        m = json.loads(subprocess.check_output(["node", str(APP / "tools" / "layout-data.mjs"), str(w), str(h)]))["main"]
        out = APP / "assets" / t / "icons"
        out.mkdir(exist_ok=True)
        glyph("alarm-clock", m["chipIcon"]["w"], YELLOW).save(out / "alarm.png")
        glyph("settings", m["gear"]["w"], WHITE, KEY).save(out / "gear.png")
        glyph("settings", m["gear"]["w"], WHITE, KEY_DOWN).save(out / "gear-press.png")
        print(f"wrote {t}/icons: alarm {m['chipIcon']['w']} px, gear {m['gear']['w']} px")


if __name__ == "__main__":
    main()
    icons()
