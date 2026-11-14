import { createWidget, deleteWidget, widget, prop, align, text_style, event, keyboard, inputType, getRtlLayout } from '@zos/ui'
import { getDeviceInfo } from '@zos/device'
import { LocalStorage } from '@zos/storage'
import { Vibrator, VIBRATOR_SCENE_SHORT_LIGHT } from '@zos/sensor'
import { lastWordLength, atSentenceStart, phraseToInsert, tail } from './text'
import { isRound, span, cells, grid, widestRow } from '../lib/geometry'

const SHIFT = 'SHIFT'
// On round screens the EN/ع and ١٢٣ keys sit at the ends of each page's widest row (see sides()).
const LANG = 'LANG'
const SYM = 'SYM'
// The phone (Gboard) Arabic layout, row for row.
const AR = [
  ['ض', 'ص', 'ث', 'ق', 'ف', 'غ', 'ع', 'ه', 'خ', 'ح', 'ج'],
  ['ش', 'س', 'ي', 'ب', 'ل', 'ا', 'ت', 'ن', 'م', 'ك', 'ط'],
  ['ذ', 'ء', 'ؤ', 'ر', 'ى', 'ة', 'و', 'ز', 'ظ', 'د', '،'],
]
const EN = [
  ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p'],
  ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l'],
  [SHIFT, 'z', 'x', 'c', 'v', 'b', 'n', 'm'],
  [',', '.', '?', '!', "'", '-', ':', ';', '(', ')'],
]
const DIGITS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0']
const AR_DIGITS = ['١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩', '٠']
const MARKS = ['َ', 'ُ', 'ِ', 'ْ', 'ّ', 'ً', 'ٌ', 'ٍ', 'ٰ'] // fatha … tanween, superscript alef
const SYMBOLS = [
  ['@', '#', '%', '&', '*', '-', '+', '=', '(', ')'],
  ['/', ':', '"', "'", '_', '…', '~', '$', '°', '!'],
]
const SYM_AR = [AR_DIGITS, [...MARKS, 'ـ'], ...SYMBOLS]
const SYM_EN = [DIGITS, ['[', ']', '{', '}', '<', '>', '^', '|', '\\', '€'], ...SYMBOLS]
// Greetings and replies first, then honorifics. [label, text, long-press text]
const PHRASES = [
  ['السلام عليكم', 'السلام عليكم'],
  ['وعليكم السلام', 'وعليكم السلام'],
  ['جزاك الله خيرا', 'جزاك الله خيرا'],
  ['وإياكم', 'وإياكم'],
  ['بارك الله فيك', 'بارك الله فيك'],
  ['إن شاء الله', 'إن شاء الله'],
  ['ما شاء الله', 'ما شاء الله'],
  ['الحمد لله', 'الحمد لله'],
  ['بسم الله', 'بسم الله'],
  ['صلى الله عليه وسلم', 'صلى الله عليه وسلم', 'ﷺ'],
  ['رضي الله عنه', 'رضي الله عنه'],
  ['عليه السلام', 'عليه السلام'],
  ['رحمه الله', 'رحمه الله'],
  ['سبحانه وتعالى', 'سبحانه وتعالى'],
]
// Long-press a key to pick one of these.
const VARIANTS = {
  'ا': ['أ', 'إ', 'آ', 'ٱ'], 'ي': ['ئ', 'ى'], 'ى': ['ئ'], 'و': ['ؤ'], 'ه': ['ة'], 'ء': ['أ', 'إ', 'ؤ', 'ئ'],
  'ج': ['چ'], 'ك': ['گ'], 'ف': ['ڤ'], 'ب': ['پ'],
  '،': ['؟', '؛', '.', '!', '«', '»', ':'],
  'a': ['à', 'á', 'â', 'ä'], 'e': ['é', 'è', 'ê', 'ë'], 'i': ['í', 'î', 'ï'], 'o': ['ó', 'ô', 'ö'],
  'u': ['ú', 'û', 'ü'], 'n': ['ñ'], 'c': ['ç'],
  '%': ['٪'], '(': ['[', '{', '<'], ')': [']', '}', '>'], '$': ['€', '£'], '"': ['«', '»'], '-': ['–', '—'],
}
DIGITS.forEach((d, i) => {
  VARIANTS[d] = [AR_DIGITS[i]]
  VARIANTS[AR_DIGITS[i]] = [d]
})

const KEY = { normal_color: 0x333333, press_color: 0x777777, radius: 8, text_size: 30, color: 0xffffff }
const POP = { ...KEY, normal_color: 0x0a84ff, press_color: 0x5ab0ff }
// Keys with long-press variants get a blue-grey tint instead of a separate dot widget.
const KEY_ALT = { ...KEY, normal_color: 0x26384f }
const BUBBLE = { w: 72, h: 80 }
// Held DEL: first repeat after HOLD_MS, then one every REPEAT_MS; after WORD_AFTER letters, whole words.
const HOLD_MS = 450
const REPEAT_MS = 90
const WORD_AFTER = 10
const SHIFT_LABEL = ['abc', 'Abc', 'ABC'] // off, next letter, caps lock
const STORE_KEY = 'letters'
// Real 432×514 thanks to "_pikeCompatibled" in app.json; without it the Bip Max reports 390×450.
const { width: W, height: H } = getDeviceInfo()
const ROUND = isRound(W, H)
const MARGIN = ROUND ? 4 : 12 // a circle's own curve keeps rows off the edge

// Phrase cells hold 2 per row; the side keys are a little wider than a letter.
const weight = (cell) => (Array.isArray(cell) ? 4 : cell === LANG || cell === SYM ? 1.5 : 1)
// The bottom of a circle is too narrow for 8 action keys, so two move up to the ends of the widest
// row (nearest the middle). On the last row they'd squeeze its letters to ~23 px; there, ~28.
const sides = (rows, widest) => (ROUND ? rows.map((row, r) => (r === widest ? [LANG, ...row, SYM] : row)) : rows)
const PHRASE_ROWS = PHRASES.reduce((rows, p, i) => (i % 2 ? rows[rows.length - 1].push(p) : rows.push([p]), rows), [])

// Optional extras: each may be unavailable inside a keyboard widget, so failures are ignored.
const tryDo = (fn) => {
  try {
    return fn()
  } catch (e) {
    return undefined
  }
}
const store = tryDo(() => new LocalStorage())
const vibrator = tryDo(() => new Vibrator())
tryDo(() => vibrator.setMode({ mode: VIBRATOR_SCENE_SHORT_LIGHT }))
const buzz = () => tryDo(() => vibrator.start())

// A combining mark alone has nothing to sit on; show it on a tatweel.
const label = (ch) => (MARKS.includes(ch) ? 'ـ' + ch : ch)

DataWidget({
  state: { page: 'letters', letters: 'ar', shift: 0, popup: [] },

  build() {
    const rect = keyboard.getContentRect()
    // On a circle, rows that start too high are narrow, whatever the field's height.
    const top = ROUND ? Math.max(rect.h + 8, Math.round(H * 0.22)) : rect.h + 8
    // Rows stay short of the bottom: rounded corners on a rectangle, the narrow end of a circle.
    const bottom = ROUND ? H - Math.round(H * 0.1) : H - 16
    const actionH = Math.floor((bottom - top) / 5)
    this.geo = { top, bottom, actionH, actionY: bottom - actionH }
    // Last letters page used, else Arabic when the watch language is right to left.
    const saved = tryDo(() => store.getItem(STORE_KEY))
    this.state.letters = saved === 'ar' || saved === 'en' ? saved : tryDo(getRtlLayout) === false ? 'en' : 'ar'
    // The firmware field draws Arabic left to right, so we cover it and draw the text ourselves.
    // The text it holds (and hands to the app) is in the right order; only its drawing is wrong.
    createWidget(widget.FILL_RECT, { x: 0, y: 0, w: W, h: rect.h, color: 0x000000 })
    const y = Math.max(rect.y, 40)
    const f = span(W, H, y, rect.h, ROUND ? 8 : 40)
    // What fits, estimated (no text measuring here; too much would hide the newest words): lines of
    // 1.2 × the size and letters 0.5 × wide (both measured in the simulator, Arabic ~0.42), less ~4
    // letters a line lost to word wrapping. Only the end of longer text is shown.
    const size = 36
    const lines = Math.max(Math.floor((rect.h - y) / (size * 1.2)), 1)
    this.fieldChars = lines * Math.max(Math.floor(f.w / (size * 0.5)) - 4, 4)
    this.field = createWidget(widget.TEXT, {
      x: f.x, y, w: f.w, h: rect.h - y, text_size: size, color: 0xffffff,
      align_h: align.CENTER_H, align_v: align.BOTTOM, text_style: text_style.WRAP, text: '',
    })
    this.drawActions()
    this.updateLabels()
    this.groups = {} // one GROUP per page, built on first visit, then only shown or hidden
    // The firmware builds every enabled keyboard when any keyboard opens, then pauses it; ours is
    // resumed only when selected. So keys wait for onResume unless we're already the selected one.
    if (tryDo(() => keyboard.isSelected()) !== false) this.start()
  },

  onResume() {
    if (!this.current) this.start()
  },

  // First page now, the other letters page shortly after so the first EN/ع switch is instant.
  start() {
    this.showPage()
    this.warm = tryDo(() => setTimeout(() => this.page(this.state.letters === 'ar' ? 'en' : 'ar'), 300))
  },

  onPause() {
    this.stopDelete()
  },

  onDestroy() {
    this.stopDelete()
    tryDo(() => clearTimeout(this.warm))
  },

  pageId() {
    const { page, letters } = this.state
    if (page !== 'letters') return page === 'sym' ? 'sym-' + letters : page
    return letters
  },

  rows(id) {
    return { ar: AR, en: EN, 'sym-ar': SYM_AR, 'sym-en': SYM_EN, phr: PHRASE_ROWS }[id]
  },

  // The cached page for id, built hidden on first use.
  page(id) {
    if (!this.groups[id]) {
      const { top, actionY } = this.geo
      // Children of a GROUP are positioned relative to it.
      const group = createWidget(widget.GROUP, { x: 0, y: top, w: W, h: actionY - top })
      group.setProperty(prop.VISIBLE, false)
      const rows = this.rows(id)
      this.groups[id] = this.drawGrid(group, sides(rows, widestRow(W, H, top, actionY, rows.length)))
      this.bubbleBelow = true // the new group draws above the reused bubble
    }
    return this.groups[id]
  },

  showPage() {
    this.closePopup()
    if (this.current) this.current.group.setProperty(prop.VISIBLE, false)
    this.current = this.page(this.pageId())
    this.current.group.setProperty(prop.VISIBLE, true)
    this.updateLabels()
    this.afterChange(true)
  },

  // Returns the page: its group, row height, the keys shift relabels (English only), and on round
  // screens its own EN/ع and ١٢٣ keys.
  drawGrid(group, rows) {
    const { top, actionY } = this.geo
    const boxes = grid(W, H, top, actionY, rows.map((row) => row.map(weight)), MARGIN)
    const page = { group, rowH: Math.floor((actionY - top) / rows.length), letters: [], shiftKey: null }
    const button = (props) => group.createWidget(widget.BUTTON, props)
    rows.forEach((row, r) => row.forEach((ch, i) => {
      const { x, w, h } = boxes[r][i]
      const keyY = boxes[r][i].y
      const at = { x, y: keyY - top, w, h } // children of a GROUP are positioned relative to it
      if (ch === SHIFT) {
        page.shiftKey = button({ ...KEY, text_size: 18, ...at, text: SHIFT_LABEL[this.state.shift],
          click_func: () => this.setShift((this.state.shift + 1) % 3) })
        return
      }
      if (ch === LANG) return (page.langBtn = button({ ...KEY, text_size: 18, ...at, ...this.langActions() }))
      if (ch === SYM) return (page.symBtn = button({ ...KEY, text_size: 18, ...at, click_func: () => this.setPage('sym') }))
      if (Array.isArray(ch)) {
        const [text, value, long] = ch
        button({ ...(long ? KEY_ALT : KEY), text_size: 20, ...at, text,
          click_func: () => this.typePhrase(value), longpress_func: long ? () => this.typePhrase(long) : undefined })
        return
      }
      // Wide glyphs (ض ص ش) that don't fit make the button scroll its text; ~0.62 of the width fits.
      const size = Math.min(30, Math.floor(w * 0.62))
      // Case is read at tap time, so shift only relabels keys instead of rebuilding them.
      const out = () => (this.state.shift > 0 ? ch.toUpperCase() : ch)
      const key = button({
        ...(VARIANTS[ch] ? KEY_ALT : KEY), text_size: size, ...at, text: label(ch),
        click_func: () => this.type(out()),
        longpress_func: VARIANTS[ch]
          ? () => this.openPopup(VARIANTS[ch].map((v) => (this.state.shift > 0 ? v.toUpperCase() : v)), x + w / 2, keyY)
          : undefined,
      })
      this.magnify(key, () => label(out()), x + w / 2, keyY)
      if (ch.toUpperCase() !== ch) page.letters.push([key, ch])
    }))
    return page
  },

  // EN/ع: switch the letters; long-press opens the keyboard picker.
  langActions() {
    return {
      click_func: () => this.setLetters(this.state.letters === 'ar' ? 'en' : 'ar'),
      longpress_func: () => keyboard.sendFnKey(keyboard.SELECT),
    }
  },

  // While a key is held, show its letter large above the finger. One bubble is reused: moved with
  // prop.MORE (a BUTTON needs x, y, w and h all set), and recreated only when a newer page group
  // would draw over it.
  magnify(key, text, cx, keyY) {
    tryDo(() => {
      key.addEventListener(event.CLICK_DOWN, () => {
        const y = Math.max(keyY - BUBBLE.h - 4, 0)
        const s = span(W, H, y, y + BUBBLE.h, 0)
        const x = Math.min(Math.max(Math.round(cx - BUBBLE.w / 2), s.x), s.x + s.w - BUBBLE.w)
        const at = { ...BUBBLE, x, y, text: text() }
        if (this.bubble && !this.bubbleBelow) {
          this.bubble.setProperty(prop.MORE, at)
          this.bubble.setProperty(prop.VISIBLE, true)
        } else {
          if (this.bubble) deleteWidget(this.bubble)
          this.bubble = createWidget(widget.BUTTON, { ...POP, text_size: 48, ...at })
          this.bubbleBelow = false
        }
        this.bubbleShown = true
      })
      key.addEventListener(event.CLICK_UP, () => this.hideBubble())
      // Sliding off a key cancels the press without a CLICK_UP on it.
      key.addEventListener(event.MOVE_OUT, () => this.hideBubble())
    })
  },

  hideBubble() {
    if (!this.bubbleShown) return
    this.bubble.setProperty(prop.VISIBLE, false)
    this.bubbleShown = false
  },

  drawActions() {
    const { actionY, actionH, bottom } = this.geo
    // Rectangle: clear the rounded bottom corners (50 px on the Bip Max). Circle: its chord.
    const strip = span(W, H, actionY, bottom, ROUND ? 4 : Math.round(W * 0.116))
    // [name, width in units, label, handlers]. Long-press space: switch to the system keyboard.
    const items = [
      !ROUND && ['lang', 1, '', this.langActions()],
      !ROUND && ['sym', 1, '', { click_func: () => this.setPage('sym') }],
      ['phr', 1, '', { click_func: () => this.setPage('phr') }],
      // No brackets: right-to-left text flips them, so ":)" shows as "(:".
      ['emoji', 1, '^_^', { click_func: () => tryDo(() => keyboard.switchInputType(inputType.EMOJI)) }],
      ['space', 2, 'space', { click_func: () => this.type(' '), longpress_func: () => keyboard.sendFnKey(keyboard.SWITCH) }],
      ['del', 1, 'DEL', {}],
      ['ok', 1, 'OK', { click_func: () => keyboard.sendFnKey(keyboard.ENTER) }],
    ].filter(Boolean)
    const keys = {}
    cells(strip, items.map((it) => it[1])).forEach(({ x, w }, i) => {
      const [name, , text, handlers] = items[i]
      keys[name] = createWidget(widget.BUTTON, { ...KEY, text_size: 18, x: x + 2, y: actionY + 2, w: w - 4, h: actionH - 4, text, ...handlers })
    })
    this.langBtn = keys.lang
    this.symBtn = keys.sym
    this.phrBtn = keys.phr
    // DEL deletes on press and repeats while held, so it's driven by press events, not click_func.
    tryDo(() => {
      keys.del.addEventListener(event.CLICK_DOWN, () => this.startDelete())
      keys.del.addEventListener(event.CLICK_UP, () => this.stopDelete())
      keys.del.addEventListener(event.MOVE_OUT, () => this.stopDelete())
    })
  },

  updateLabels() {
    const { page, letters } = this.state
    const ar = letters === 'ar'
    const back = ar ? 'أبج' : 'abc'
    // Round: each page has its own EN/ع and ١٢٣ keys (none before the first page is shown).
    const { langBtn, symBtn } = ROUND ? this.current || {} : this
    if (langBtn) langBtn.setProperty(prop.TEXT, ar ? 'EN' : 'ع')
    if (symBtn) symBtn.setProperty(prop.TEXT, page === 'sym' ? back : ar ? '١٢٣' : '123')
    this.phrBtn.setProperty(prop.TEXT, page === 'phr' ? back : 'رد')
  },

  // Variant keys in a strip just above the pressed key, centred on it and kept on screen.
  openPopup(alts, cx, keyY) {
    this.closePopup()
    const { rowH } = this.current
    const s = span(W, H, keyY - rowH, keyY, 8)
    const w = Math.min(56, Math.floor(s.w / alts.length)) // ، has 7 variants: 392 px at 56
    const x0 = Math.min(Math.max(Math.round(cx - (alts.length * w) / 2), s.x), s.x + s.w - alts.length * w)
    this.state.popup = alts.map((ch, i) =>
      createWidget(widget.BUTTON, {
        ...POP, text_size: 26, x: x0 + i * w + 2, y: keyY - rowH, w: w - 4, h: rowH - 4, text: label(ch),
        click_func: () => this.type(ch),
      }),
    )
  },

  closePopup() {
    this.hideBubble()
    this.state.popup.forEach((k) => deleteWidget(k))
    this.state.popup = []
  },

  setLetters(letters) {
    this.state.letters = letters
    this.state.page = 'letters'
    tryDo(() => store.setItem(STORE_KEY, letters))
    this.showPage()
  },

  // The ١٢٣ and رد keys open their page, and pressed again go back to the letters.
  setPage(page) {
    this.state.page = this.state.page === page ? 'letters' : page
    this.showPage()
  },

  setShift(shift) {
    this.state.shift = shift
    const { letters, shiftKey } = this.current
    letters.forEach(([key, ch]) => key.setProperty(prop.TEXT, shift > 0 ? ch.toUpperCase() : ch))
    if (shiftKey) shiftKey.setProperty(prop.TEXT, SHIFT_LABEL[shift])
  },

  type(text) {
    buzz()
    keyboard.inputText(text)
    this.afterChange()
  },

  typePhrase(phrase) {
    this.type(phraseToInsert(keyboard.getTextContext() || '', phrase))
  },

  del(count) {
    if (!count) return
    keyboard.backspace(count)
    this.afterChange()
  },

  startDelete() {
    this.stopDelete()
    buzz()
    this.del(1)
    let n = 0
    this.holdTimer = setTimeout(() => {
      this.repeatTimer = setInterval(() => {
        n += 1
        this.del(n > WORD_AFTER ? lastWordLength(keyboard.getTextContext() || '') : 1)
      }, REPEAT_MS)
    }, HOLD_MS)
  },

  stopDelete() {
    tryDo(() => clearTimeout(this.holdTimer))
    tryDo(() => clearInterval(this.repeatTimer))
  },

  // Refresh our field; on the English letters, shift follows the sentence unless caps lock is on.
  // force: relabel even if shift is unchanged (a cached page may show the case it was left in).
  afterChange(force) {
    this.closePopup()
    const text = keyboard.getTextContext() || ''
    this.field.setProperty(prop.TEXT, tail(text, this.fieldChars))
    const { shift } = this.state
    const next = !this.current.shiftKey ? 0 : shift === 2 ? 2 : atSentenceStart(text) ? 1 : 0
    if (force || next !== shift) this.setShift(next)
  },
})
