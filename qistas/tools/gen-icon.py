"""Original balance artwork, supersampled; no third-party artwork is bundled."""
import json
import math
import subprocess
from pathlib import Path
from PIL import Image, ImageDraw

APP = Path(__file__).resolve().parents[1]
OUT = APP.parent / 'docs' / 'qistas'
NOTICE = '''Qistas
Copyright (C) 2026 yshalsager

This program is free software: you can redistribute it and/or modify it under the terms of the
GNU General Public License version 3 as published by the Free Software Foundation. It comes with
ABSOLUTELY NO WARRANTY. Source code and the full license:
https://github.com/yshalsager/zeppos-muslim-apps (LICENSE, GPL-3.0)

The package bundles no third-party code, fonts or artwork. Conversion definitions and scholarly
estimates are documented in qistas/README.md in the source repository.
'''


def icon():
    im = Image.new('RGBA', (992, 992))
    d = ImageDraw.Draw(im)
    d.ellipse((16, 16, 976, 976), fill='#b9e076')
    ink = '#18230c'
    d.line((496, 244, 496, 724), fill=ink, width=30)
    d.line((288, 348, 704, 308), fill=ink, width=30)
    d.line((372, 736, 620, 736), fill=ink, width=30)
    d.ellipse((468, 232, 524, 288), fill=ink)
    for x, y in ((300, 348), (692, 308)):
        d.line((x, y, x - 108, y + 208), fill=ink, width=18)
        d.line((x, y, x + 108, y + 208), fill=ink, width=18)
        d.pieslice((x - 112, y + 96, x + 112, y + 320), 0, 180, fill=ink)
    return im.resize((248, 248), Image.Resampling.LANCZOS)


def control(name, w, h, pressed):
    im = Image.new('RGBA', (w * 4, h * 4))
    d = ImageDraw.Draw(im)
    d.rounded_rectangle((0, 0, w * 4 - 1, h * 4 - 1), radius=48, fill='#394047' if pressed else '#24282c')
    cx, cy, r = w * 2, h * 2, min(w, h) * 1.2
    color = '#b9e076' if name == 'star-on' else 'white'
    if name.startswith('star'):
        pts = [(cx + math.cos(-math.pi / 2 + i * math.pi / 5) * r * (1 if i % 2 == 0 else .44), cy + math.sin(-math.pi / 2 + i * math.pi / 5) * r * (1 if i % 2 == 0 else .44)) for i in range(10)]
        d.polygon(pts, fill=color if name == 'star-on' else None, outline=color, width=6)
    elif name == 'swap':
        for dx, sign in ((-r / 2, -1), (r / 2, 1)):
            x, y = cx + dx, cy + sign * r
            d.line((x, cy - sign * r, x, y), fill=color, width=7)
            d.line((x - r * .35, y - sign * r * .4, x, y, x + r * .35, y - sign * r * .4), fill=color, width=7)
    else:
        d.polygon(((cx - r, cy), (cx - r * .4, cy - r * .65), (cx + r, cy - r * .65), (cx + r, cy + r * .65), (cx - r * .4, cy + r * .65)), outline=color, width=6)
        for sign in (-1, 1):
            d.line((cx, cy + sign * r * .3, cx + r * .6, cy - sign * r * .3), fill=color, width=6)
    return im.resize((w, h), Image.Resampling.LANCZOS)


def main():
    im = icon()
    for target in json.loads((APP / 'app.json').read_text())['targets']:
        out = APP / 'assets' / target
        out.mkdir(parents=True, exist_ok=True)
        im.save(out / 'icon.png', optimize=True)
        (out / 'NOTICE.txt').write_text(NOTICE)
        device = json.loads((APP.parent / 'devices.json').read_text())[target]
        layout = json.loads(subprocess.check_output(['node', str(APP / 'tools' / 'layout-data.mjs'), str(device['width']), str(device['height'])]))
        icons = out / 'icons'
        icons.mkdir(exist_ok=True)
        for name, box in [('swap', layout['swap']), ('star', layout['favourite']), ('star-on', layout['favourite']), ('delete', layout['keys'][-2])]:
            for pressed in (False, True):
                control(name, box['w'], box['h'], pressed).save(icons / f'{name}{"-press" if pressed else ""}.png', optimize=True)
    OUT.mkdir(parents=True, exist_ok=True)
    im.crop((4, 4, 244, 244)).save(OUT / 'icon.png', optimize=True)


if __name__ == '__main__':
    main()
