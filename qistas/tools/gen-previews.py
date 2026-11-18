"""Draw the real pages via shared @zos stubs and the shared text renderer."""
import argparse
import json
import subprocess
import sys
from pathlib import Path
APP = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(APP.parent / 'shared'))
from PIL import Image, ImageDraw
from widget_draw import draw

README_SHOTS = {
    'en-home.png', 'en-converter.png', 'en-keypad.png',
    'ar-islamic.png', 'ar-settings.png', 'ar-fitr.png',
    'round-pace-en.png', 'round-pace-keypad-ar.png',
}
SHOTS = {
    'home': ('index', '', ''), 'converter': ('converter', '', ''),
    'keypad': ('keypad', '', ''), 'units': ('units', '', 'from'),
    'islamic': ('islamic', '', ''), 'nisab': ('converter', 'nisab', ''),
    'fitr': ('converter', 'fitr', ''), 'pace': ('converter', 'pace', ''),
    'settings': ('settings', '', ''),
    'sa-opinions': ('opinions', '', 'sa'), 'sa-more': ('opinions', 'last', 'sa'),
    'wheat': ('converter', 'wheat', ''),
    'cooking': ('units', 'volume', 'from'),
    'home-empty': ('index', 'empty', ''), 'home-bottom': ('index', 'last', ''),
    'pace-keypad': ('keypad', 'pace', ''),
    'gold-karats': ('converter', 'karats', ''), 'land': ('converter', 'land', ''),
    'coins': ('converter', 'coins', ''), 'indic-digits': ('converter', 'indic', ''),
    'ingredients': ('converter', 'ingredients', ''), 'ingredient-list': ('ingredients', 'ingredients', ''),
    'fuel': ('converter', 'fuel', ''), 'pressure': ('converter', 'pressure', ''), 'energy': ('converter', 'energy', ''),
    'oven': ('converter', 'oven', ''), 'crops': ('converter', 'crops', ''), 'kaffara': ('converter', 'kaffara', ''),
    'mahr': ('converter', 'mahr', ''), 'poor-options': ('opinions', '', 'poor_person'),
    'recent': ('recent', '', ''), 'recent-bottom': ('recent', 'last', ''),
}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--all', action='store_true', help='Render every screen into .cache/previews/qistas')
    args = parser.parse_args()
    out = APP.parent / ('.cache/previews/qistas' if args.all else 'docs/qistas')
    out.mkdir(parents=True, exist_ok=True)
    for prefix, target, w, h, radius in (('', 'bip-max', 432, 514, 106), ('round-', 'round-480', 480, 480, 240)):
        for lang in ('en', 'ar'):
            for shot, (page, mode, params) in SHOTS.items():
                name = f'{prefix}{shot}-{lang}.png' if prefix else f'{lang}-{shot}.png'
                if not args.all and name not in README_SHOTS:
                    continue
                command = ['node', str(APP / 'tools' / 'preview-data.mjs'), page, lang, mode, params, str(w), str(h)]
                data = json.loads(subprocess.check_output(command, cwd=APP))
                im = draw(data, APP / 'assets' / target)
                mask = Image.new('L', (w * 4, h * 4), 0)
                ImageDraw.Draw(mask).rounded_rectangle((0, 0, w * 4 - 1, h * 4 - 1), radius=radius * 4, fill=255)
                im.putalpha(mask.resize((w, h), Image.Resampling.LANCZOS))
                if prefix:
                    im = im.resize((360, 360), Image.Resampling.LANCZOS)
                im.save(out / name, optimize=True)
    print(f'wrote {len(SHOTS) * 4 if args.all else len(README_SHOTS)} previews to {out.relative_to(APP.parent)}')


if __name__ == '__main__':
    main()
