"""Builds a small Arabic font for the watch from SIL's Scheherazade New (OFL 1.1).

Run (needs fontTools + uharfbuzz, not project dependencies):
    uv run --no-project --with fonttools --with uharfbuzz python3 -I tools/gen-font.py \
        path/to/ScheherazadeNew-Medium.ttf path/to/NotoSans[wdth,wght].ttf path/to/NotoSansArabic[wdth,wght].ttf

- Subsets to the characters this face's code uses (plus printable ASCII), keeping all OpenType
  layout features so the watch can join Arabic letters.
- Adds Arabic Presentation Forms-B (U+FE70–FEFC). Zepp OS shapes Arabic itself by converting
  letters to presentation-form code points, and Scheherazade has none (it relies on OpenType
  features), so every letter rendered as .notdef. Each form is shaped with HarfBuzz using the
  font's own rules (ZWJ context for initial/medial/final); a single resulting glyph is mapped
  directly, several glyphs (lam-alef, marks) become a composite glyph at HarfBuzz's offsets.
- Replaces the digits (Latin and Arabic-Indic) and the punctuation used with them by Noto Sans /
  Noto Sans Arabic (OFL 1.1) at Medium weight. The clock and prayer times use the watch's sans
  system font; this keeps every number on the face in one sans style instead of mixing in
  Scheherazade's serif numerals. Only the cmap glyph is replaced: Zepp OS renders cmap glyphs
  directly (no OpenType features), so digit variants reachable through GSUB don't matter.
- "Scheherazade" and "SIL" are Reserved Font Names, and a subset is a Modified Version under the
  OFL, so the family is renamed. SIL's copyright and license name records are kept in the font.
"""
import io
import re
import sys
import unicodedata
from pathlib import Path

import uharfbuzz as hb

from fontTools import subset
from fontTools.pens.recordingPen import DecomposingRecordingPen
from fontTools.pens.transformPen import TransformPen
from fontTools.pens.ttGlyphPen import TTGlyphPen
from fontTools.ttLib import TTFont
from fontTools.ttLib.tables._g_l_y_f import Glyph, GlyphComponent
from fontTools.varLib import instancer

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "assets" / "bip-max" / "fonts" / "naskh.ttf"
FAMILY = "Prayer Face Naskh"
SOURCES = [ROOT / "watchface" / "index.js", *(ROOT / "lib").glob("*.js")]


def used_chars():
    chars = {chr(c) for c in range(0x20, 0x7F)}
    for f in SOURCES:
        chars |= {ch for ch in f.read_text() if ord(ch) > 0x7F}
    # Escapes like '‏' in the source are written as text; add the marks/digits we emit.
    chars |= set("٠١٢٣٤٥٦٧٨٩٪°،‏")
    return "".join(sorted(chars))


ZWJ = "\u200d"
FORM_CONTEXT = {"isolated": ("", ""), "initial": ("", ZWJ), "medial": (ZWJ, ZWJ), "final": (ZWJ, "")}


def presentation_targets(chars):
    """(code point, base text, form) for every Presentation Forms-B char whose letters we use."""
    out = []
    for cp in range(0xFE70, 0xFEFD):
        decomp = unicodedata.decomposition(chr(cp))
        if not decomp.startswith("<"):
            continue
        form, *codes = decomp.split()
        form = form.strip("<>")
        if form not in FORM_CONTEXT:
            continue
        base = "".join(chr(int(c, 16)) for c in codes)
        if all(ch in chars for ch in base):
            out.append((cp, base, form))
    return out


def add_presentation_forms(font, chars):
    buf = io.BytesIO()
    font.save(buf)
    hb_font = hb.Font(hb.Face(buf.getvalue()))
    order = font.getGlyphOrder()
    glyf, hmtx = font["glyf"], font["hmtx"]
    new_cmap = {}
    composites = 0
    for cp, base, form in presentation_targets(chars):
        before, after = FORM_CONTEXT[form]
        b = hb.Buffer()
        b.add_str(before + base + after)
        b.guess_segment_properties()
        hb.shape(hb_font, b, {})
        # drop the ZWJ helpers (they shape to zero-width glyphs at the edges); keep the letter's glyphs
        cl_first, cl_last = len(before), len(before) + len(base)
        items = [(i, p) for i, p in zip(b.glyph_infos, b.glyph_positions) if cl_first <= i.cluster < cl_last]
        if not items:
            continue
        if len(items) == 1 and items[0][1].x_offset == 0 and items[0][1].y_offset == 0:
            new_cmap[cp] = order[items[0][0].codepoint]
            continue
        # Composite: HarfBuzz output is in visual order (left to right) for RTL text.
        name = f"uni{cp:04X}"
        g = Glyph()
        g.numberOfContours = -1
        g.components = []
        x = 0
        for info, pos in items:
            comp = GlyphComponent()
            comp.glyphName = order[info.codepoint]
            comp.x, comp.y = x + pos.x_offset, pos.y_offset
            comp.flags = 0x4  # ROUND_XY_TO_GRID
            g.components.append(comp)
            x += pos.x_advance
        glyf.glyphs[name] = g
        order.append(name)
        hmtx.metrics[name] = (x, 0)
        new_cmap[cp] = name
        composites += 1
    font.setGlyphOrder(order)
    font["maxp"].numGlyphs = len(order)
    for g in [glyf[n] for n in order if glyf[n].isComposite()]:
        g.recalcBounds(glyf)
    for table in font["cmap"].tables:
        if table.isUnicode():
            table.cmap.update(new_cmap)
    return f"{len(new_cmap)} mapped ({composites} composites)"


LATIN_SANS = "0123456789/:.%°"
ARABIC_SANS = "٠١٢٣٤٥٦٧٨٩٪٫"


def sans_instance(path):
    font = TTFont(path)
    if "fvar" in font:
        font = instancer.instantiateVariableFont(font, {"wght": 500, "wdth": 100})
    return font


def replace_glyphs(font, donor, chars):
    """Redraws the font's glyph for each char with the donor's outline, scaled to the font's em."""
    scale = font["head"].unitsPerEm / donor["head"].unitsPerEm
    cmap, dcmap = font.getBestCmap(), donor.getBestCmap()
    dset = donor.getGlyphSet()
    glyf, hmtx = font["glyf"], font["hmtx"]
    done = 0
    for ch in chars:
        name, dname = cmap.get(ord(ch)), dcmap.get(ord(ch))
        if not name or not dname:
            continue
        rec = DecomposingRecordingPen(dset)  # donor composites (e.g. %) become plain outlines
        dset[dname].draw(rec)
        pen = TTGlyphPen(None)
        rec.replay(TransformPen(pen, (scale, 0, 0, scale, 0, 0)))
        glyf[name] = pen.glyph()
        glyf[name].recalcBounds(glyf)
        hmtx[name] = (round(dset[dname].width * scale), getattr(glyf[name], "xMin", 0))
        done += 1
    return done


def main(src, latin_sans, arabic_sans):
    text = used_chars()
    opts = subset.Options()
    opts.layout_features = ["*"]  # keep init/medi/fina/rlig/mark/... for Arabic joining
    opts.name_IDs = ["*"]
    opts.name_languages = ["*"]
    opts.hinting = False
    opts.notdef_outline = True
    font = TTFont(src)
    sub = subset.Subsetter(opts)
    sub.populate(text=text)
    sub.subset(font)

    name = font["name"]
    original = name.getDebugName(4)
    for rec in name.names:
        if rec.nameID in (1, 4, 16, 21):
            rec.string = re.sub(r"Scheherazade New|Scheherazade", FAMILY, str(rec)).replace("SIL ", "")
        elif rec.nameID in (3, 6, 20):
            rec.string = re.sub(r"ScheherazadeNew|Scheherazade", FAMILY.replace(" ", ""), str(rec))
    name.setName(f"Subset of {original} (SIL Global), renamed per OFL Reserved Font Name terms.", 10, 3, 1, 0x409)

    added = add_presentation_forms(font, set(text))
    swapped = replace_glyphs(font, sans_instance(latin_sans), LATIN_SANS)
    swapped += replace_glyphs(font, sans_instance(arabic_sans), ARABIC_SANS)

    OUT.parent.mkdir(parents=True, exist_ok=True)
    font.save(OUT)
    print(f"presentation forms: {added}; sans digits/punctuation: {swapped} glyphs")
    print(f"{len(text)} chars, {OUT.stat().st_size // 1024} KB → {OUT.relative_to(ROOT)} ({name.getDebugName(4)})")


if __name__ == "__main__":
    main(*sys.argv[1:4])
