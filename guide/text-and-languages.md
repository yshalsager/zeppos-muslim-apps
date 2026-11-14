# Text and languages

## Arabic

- **The firmware shapes Arabic (watch).** `TEXT` widgets join letters and lay out right to left by themselves; pass logical text, never reversed text.
- **Custom fonts need Presentation Forms-B.** The firmware shapes by swapping letters for their Arabic Presentation Forms-B code points (U+FE70–U+FEFF), then draws those glyphs. Most modern Arabic fonts don't have them, so a custom font draws boxes or unjoined letters until you add them. We build them from the font's own OpenType shaping with HarfBuzz (`prayer-times-watchface/tools/gen-font.py`).
- **Subset the font to the text you use.** A 340-glyph Naskh subset is 67 KB. Generate the character set from your source and data files and regenerate when they change, or new strings show missing glyphs.
- **Mind the font licence.** A subset of an OFL font is a Modified Version: rename it if the font has Reserved Font Names, and ship the licence (inside the font's `name` table or as a file).
- **U+200F (RLM) before an Arabic letter breaks shaping (watch):** the next letter is drawn in its final form. Use RLM only for strings that start with a digit or Latin text, to keep them right to left.
- **Keep numbers and names in separate widgets** where you can; mixed strings get reordered by the bidi algorithm in ways that are hard to predict.
- **Bidi surprises (watch):** brackets are mirrored (`:)` shows as `(:`), and bare hex digits next to Arabic get reordered (prefix each code with "U+" to keep the order).
- **Tashkeel alone in a label** (a key showing ـَ) needs a tatweel before it, or the mark has nothing to sit on (watch).
- **The system font lacks some symbols (watch):** ⌫ and ↵ were missing on the Bip Max; ﷺ was there. Check every symbol on the watch.
- **Text you send is drawn by the phone's font.** Noto Sans Arabic (Android) has every honorific ligature; Apple's Geeza Pro has only the older ﷺ ﷲ ﷻ, not the Unicode 14 ones (﵁ ﵇ ﵀ ﷾ ﷿). Type phrases out in full and offer ﷺ as the single-character option.

## Right-to-left layout

- **Alignment is mirrored for Arabic (watch).** `align_h: align.RIGHT` on an Arabic `TEXT` draws it at the left. Position the box where the text should go and centre in it, or test each case.
- **Write the layout once and mirror it.** We design right to left and pass every rectangle through a `box()` helper that mirrors x (`x → width − x − w`) for left-to-right languages. Runtime switching between the two works (watch).
- **Text input fields draw Arabic left to right (watch).** In a custom keyboard, the firmware's input field shows Arabic reversed (سلام as ملاس), even with the watch set to Arabic, while the text itself is correct (`getTextContext()`, the sent reply). Embedding marks (U+202B … U+202C) and `keyboard.setContentRect()` don't help. Fix: cover the field with a black `FILL_RECT` and draw the text in your own `TEXT` widget. Cost: the system cursor is hidden.
- **Don't let wrapped text overflow its box (simulator).** A `TEXT` with `text_style.WRAP` that outgrows its box is clipped unpredictably: centred (`align.CENTER_V`) cuts both ends, and bottom-aligned (`align.BOTTOM`) still cut the last line. There is no text measurement, so pass only what fits: estimate the characters per box from its size (we use lines of 1.2 × the text size, measured, and characters 0.5 × wide, Arabic being ~0.42, less ~4 a line for word wrapping) and show the end of the text from a word start. Skip a leading "…": in a field laid out left to right it lands after Arabic text, where it reads as the end (`tail()` in `daad-keyboard/data-widget/text.js`).

## Measuring text

- **There is no text measurement in the face API.** To shorten long names, add up estimated character widths. We generate a width table by shaping every string the face can show with HarfBuzz, in the real font (Arabic) and in Noto Sans as a stand-in for the system font, add a margin (15% / 3%), and check in a test that every line fits.
- **A cut Arabic word gets wider:** its last letter changes to the final form. Leave a few pixels extra.

## Translations

- **Load one language at a time.** Keep each language's strings as a JS module for Node, and generate `assets/<target>/i18n/<lang>.json` from it for the watch; the face reads only the chosen file. Templates that were functions become placeholders (`"{0} in {1}"`) so each language keeps its own word order. A test checks that the JSON gives the same text as the module.
- **Follow the watch's language** with `getLanguage()` (`@zos/settings`), falling back to English, and let users override it. If you only need the direction, `getRtlLayout()` (`@zos/ui`) is true when the watch language is right to left (watch).
- **The watch has no Urdu or Persian system language,** so the system font may not cover them. Check before offering a language.
- **Digits:** Arabic-Indic for Arabic, Latin for others, with a setting to override.
