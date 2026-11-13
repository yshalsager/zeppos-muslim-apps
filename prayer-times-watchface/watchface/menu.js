// A small full-screen menu drawn over the normal face. All widgets are created once (hidden), on
// the first open, and reused for every screen. Every text/colour/visibility write goes through
// h.setText/setColor/show (write-only-on-change).
//
// Lists: title with ▶ (tap = back, or close at the top level), ▲, ROWS rows, ▼ with a page counter.
// Nothing tappable sits near the bottom edge, where the watch's own swipe-up gesture starts.
// Value screen: a stepper item opens one big value with − / + (and optional fine steps).
//
// screen = { title: string | () => string, items: () => item[] }
// item   = { label, value?: () => string, color?, plain?: true (label in the system font, e.g. a
//            language's own name in another script), tap?: () => screen | void,
//            dec?, inc?: () => void, fine?: { dec, inc, label }, title?: string | () => string }
//   tap  → whole-row tap; returning a screen opens it (back returns here)
//   dec/inc → the row opens a value screen (title: item.title or item.label)
// Laid out for right-to-left; h.box() mirrors a rectangle for left-to-right languages.
import ui from '@zos/ui'

const { widget, show_level, prop } = ui
const L = show_level.ONLY_NORMAL
const ROWS = 4
const TITLE = { y: 30, h: 50 }
const UP_Y = 82
const UP_H = 42
const ROW_Y = 126
const ROW_H = 68 // rows touch: every pixel between them is part of a row
const DOWN_Y = ROW_Y + ROWS * ROW_H + 2
const DOWN_H = 56 // ends at y 456: the bottom ~60 px are left to the system gesture
// Rows with a value: label column on the right, value on the left (mirrored for left-to-right).
// Labels are centred in their box: the watch mirrors align.RIGHT for Arabic text.
const VAL = { x: 16, w: 200 }
const SIDE_X = VAL.x + VAL.w + 8
// Value screen: − and + at the sides of the value, fine steps underneath
const BIG = { y: 150, h: 140, w: 124 }
const FINE = { y: 304, h: 80, w: 192 }
const PRESSED = 0x2a2a2a

// h: { create(type, opts), text, arText, tap(area, onTap, onPress), show, setText, setColor, digits,
//      box(rect), rtl, W, H, colors: { title, text, dim, accent } }
export function createMenu(h, onClose) {
  const { create, text, arText, tap, show, setText, setColor, digits, box, rtl, W, H, colors } = h
  let stack = [] // [{ screen, offset }]
  let note = '' // one-off title message (e.g. "couldn't save")

  const top = () => stack[stack.length - 1]
  const bar = (y, h) => ({ x: 16, y, w: W - 32, h })
  const resolve = (t) => (typeof t === 'function' ? t() : t)

  const m = {
    bg: create(widget.FILL_RECT, { x: 0, y: 0, w: W, h: H, color: 0x000000, show_level: L }),
    // one highlight, moved under whatever is being pressed
    hl: create(widget.FILL_RECT, { x: 0, y: 0, w: 8, h: 8, radius: 14, color: PRESSED, show_level: L }),
    // title centred between equal margins; back arrow in the one where reading starts (▶ in RTL, ◀ in LTR)
    title: arText({ x: 48, y: TITLE.y, w: W - 96, h: TITLE.h, text_size: 28, color: colors.title }),
    back: create(widget.IMG, {
      ...box({ x: W - 48, y: TITLE.y + 9, w: 18, h: 32 }), src: rtl ? 'arrow-back.png' : 'arrow-back-ltr.png', show_level: L,
    }),
    up: create(widget.IMG, { x: (W - 32) / 2, y: UP_Y + 12, src: 'arrow-up.png', show_level: L }),
    down: create(widget.IMG, { x: (W - 32) / 2, y: DOWN_Y + 19, src: 'arrow-down.png', show_level: L }),
    count: text({ ...box({ x: W - 16 - 110, y: DOWN_Y, w: 110, h: DOWN_H }), text_size: 22, color: colors.dim }),
    rows: [],
    // value screen
    caption: arText({ x: 16, y: UP_Y, w: W - 32, h: UP_H, text_size: 24, color: colors.dim }),
    value: arText({ x: 16 + BIG.w, y: BIG.y, w: W - 32 - 2 * BIG.w, h: BIG.h, text_size: 52, color: colors.text }),
    minus: text({ x: 16, y: BIG.y, w: BIG.w, h: BIG.h, text_size: 80, color: colors.accent, text: '-' }),
    plus: text({ x: W - 16 - BIG.w, y: BIG.y, w: BIG.w, h: BIG.h, text_size: 80, color: colors.accent, text: '+' }),
    fineMinus: text({ x: 16, y: FINE.y, w: FINE.w, h: FINE.h, text_size: 34, color: colors.accent }),
    finePlus: text({ x: W - 16 - FINE.w, y: FINE.y, w: FINE.w, h: FINE.h, text_size: 34, color: colors.accent }),
  }
  for (let i = 0; i < ROWS; i++) {
    const y = ROW_Y + i * ROW_H
    m.rows.push({
      label: arText({ x: 16, y, w: W - 32, h: ROW_H, text_size: 30 }), // list rows: full width
      plain: text({ x: 16, y, w: W - 32, h: ROW_H, text_size: 30 }), // the same, in the system font
      side: arText({ ...box({ x: SIDE_X, y, w: W - 16 - SIDE_X, h: ROW_H }), text_size: 28 }), // rows with a value
      value: arText({ ...box({ x: VAL.x, y, w: VAL.w, h: ROW_H }), text_size: 30 }),
    })
  }

  // Tap areas last, so they sit on top. Each flashes the highlight while pressed.
  const press = (area) => (on) => {
    if (on) m.hl.setProperty(prop.MORE, { ...area, radius: 14, color: PRESSED })
    show([m.hl], on)
  }
  const button = (area, fn) => tap(area, fn, press(area))
  m.titleTap = button({ x: 16, y: TITLE.y, w: W - 32, h: TITLE.h }, () => back())
  m.upTap = button(bar(UP_Y, UP_H), () => scroll(-ROWS))
  m.downTap = button(bar(DOWN_Y, DOWN_H), () => scroll(ROWS))
  m.rows.forEach((r, i) => {
    r.tap = button({ x: 16, y: ROW_Y + i * ROW_H, w: W - 32, h: ROW_H }, () => act(i))
  })
  m.minusTap = button({ x: 16, y: BIG.y, w: BIG.w, h: BIG.h }, () => step((s) => s.dec))
  m.plusTap = button({ x: W - 16 - BIG.w, y: BIG.y, w: BIG.w, h: BIG.h }, () => step((s) => s.inc))
  m.fineMinusTap = button({ x: 16, y: FINE.y, w: FINE.w, h: FINE.h }, () => step((s) => s.fine.dec))
  m.finePlusTap = button({ x: W - 16 - FINE.w, y: FINE.y, w: FINE.w, h: FINE.h }, () => step((s) => s.fine.inc))

  const rowWidgets = m.rows.flatMap((r) => [r.label, r.plain, r.side, r.value, r.tap])
  const listWidgets = [m.up, m.down, m.upTap, m.downTap, m.count, ...rowWidgets]
  const valueWidgets = [m.caption, m.value, m.minus, m.plus, m.minusTap, m.plusTap]
  const fineWidgets = [m.fineMinus, m.finePlus, m.fineMinusTap, m.finePlusTap]
  const all = [m.bg, m.hl, m.title, m.back, m.titleTap, ...listWidgets, ...valueWidgets, ...fineWidgets]
  show(all, false)

  function render() {
    const { screen, offset } = top()
    const st = screen.stepper
    setText(m.title, note || resolve(screen.title))
    note = ''
    show([m.hl], false)
    show(valueWidgets, !!st)
    show(fineWidgets, !!(st && st.fine))
    if (st) {
      show(listWidgets, false)
      setText(m.caption, st.title ? st.label : '') // the title shows something else (e.g. a live date)
      setText(m.value, st.value())
      if (st.fine) {
        setText(m.fineMinus, `-${st.fine.label}`)
        setText(m.finePlus, `+${st.fine.label}`)
      }
      return
    }
    const list = screen.items()
    m.rows.forEach((r, i) => {
      const it = list[offset + i]
      const hasValue = !!(it && it.value)
      const plain = !!(it && it.plain && !hasValue)
      const label = hasValue ? r.side : plain ? r.plain : r.label
      setText(label, it ? it.label : '')
      setColor(label, (it && it.color) || colors.text)
      setText(r.value, hasValue ? it.value() : '')
      show([r.label], !!it && !hasValue && !plain)
      show([r.plain], plain)
      show([r.side, r.value], hasValue)
      show([r.tap], !!(it && (it.tap || it.dec || it.inc)))
    })
    const pages = Math.ceil(list.length / ROWS)
    show([m.up, m.upTap], offset > 0)
    show([m.down, m.downTap], offset + ROWS < list.length)
    show([m.count], pages > 1)
    if (pages > 1) setText(m.count, `${digits(offset / ROWS + 1)}/${digits(pages)}`)
  }

  function scroll(delta) {
    const n = top().screen.items().length
    const t = top()
    t.offset = Math.max(0, Math.min(t.offset + delta, Math.floor((n - 1) / ROWS) * ROWS))
    render()
  }

  function act(i) {
    const it = top().screen.items()[top().offset + i]
    if (!it) return
    if (it.dec || it.inc) {
      stack.push({ screen: { title: it.title || it.label, stepper: it }, offset: 0 })
    } else if (it.tap) {
      const next = it.tap()
      if (!stack.length) return // the action closed the menu
      if (next && next.items) stack.push({ screen: next, offset: 0 })
    }
    render()
  }

  function step(pick) {
    pick(top().screen.stepper)()
    render()
  }

  function back() {
    stack.pop()
    if (stack.length) render()
    else close()
  }

  function close() {
    if (!m.shown) return
    m.shown = false
    stack = []
    show(all, false)
    onClose()
  }

  return {
    open(screen) {
      stack = [{ screen, offset: 0 }]
      m.shown = true
      show([m.bg, m.title, m.back, m.titleTap], true)
      render()
    },
    close,
    isOpen: () => !!m.shown,
    // Shows a message in the title on the next render (item actions are followed by one).
    message(s) {
      note = s
    },
  }
}
