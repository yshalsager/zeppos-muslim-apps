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
// Boxes and text sizes come from lib/layout.js (h.L = layout().menu). Lists: 4 rows that touch, and
// nothing tappable in the bottom ~60 px, left to the system's swipe-up gesture. Rows with a value:
// label column on the right, value on the left (mirrored for left-to-right). Labels are centred in
// their box: the watch mirrors align.RIGHT for Arabic text. Value screen: − and + at the sides of
// the value, fine steps underneath.
const PRESSED = 0x2a2a2a

// h: { create(type, opts), text, arText, tap(area, onTap, onPress), show, setText, setColor, digits,
//      box(rect), rtl, L (lib/layout.js menu boxes), colors: { title, text, dim, accent } }
export function createMenu(h, onClose) {
  const { create, text, arText, tap, show, setText, setColor, digits, box, rtl, L: M, colors } = h
  const ROWS = M.rows
  let stack = [] // [{ screen, offset }]
  let note = '' // one-off title message (e.g. "couldn't save")

  const top = () => stack[stack.length - 1]
  const resolve = (t) => (typeof t === 'function' ? t() : t)
  const area = ({ x, y, w, h }) => ({ x, y, w, h }) // a text box as a tap area

  const m = {
    bg: create(widget.FILL_RECT, { ...M.bg, color: 0x000000, show_level: L }),
    // one highlight, moved under whatever is being pressed
    hl: create(widget.FILL_RECT, { x: 0, y: 0, w: 8, h: 8, radius: M.radius, color: PRESSED, show_level: L }),
    // title centred between equal margins; back arrow in the one where reading starts (▶ in RTL, ◀ in LTR)
    title: arText({ ...M.title, color: colors.title }),
    back: create(widget.IMG, { ...box(M.back), src: rtl ? 'arrow-back.png' : 'arrow-back-ltr.png', show_level: L }),
    up: create(widget.IMG, { ...M.up, src: 'arrow-up.png', show_level: L }),
    down: create(widget.IMG, { ...M.down, src: 'arrow-down.png', show_level: L }),
    count: text({ ...box(M.count), color: colors.dim }),
    rows: [],
    // value screen
    caption: arText({ ...M.caption, color: colors.dim }),
    value: arText({ ...M.value, color: colors.text }),
    minus: text({ ...M.minus, color: colors.accent, text: '-' }),
    plus: text({ ...M.plus, color: colors.accent, text: '+' }),
    fineMinus: text({ ...M.fineMinus, color: colors.accent }),
    finePlus: text({ ...M.finePlus, color: colors.accent }),
  }
  for (const r of M.row) {
    m.rows.push({
      label: arText({ ...r.label }), // list rows: full width
      plain: text({ ...r.label }), // the same, in the system font
      side: arText({ ...box(r.side) }), // rows with a value
      value: arText({ ...box(r.value) }),
    })
  }

  // Tap areas last, so they sit on top. Each flashes the highlight while pressed.
  const press = (a) => (on) => {
    if (on) m.hl.setProperty(prop.MORE, { ...a, radius: M.radius, color: PRESSED })
    show([m.hl], on)
  }
  const button = (a, fn) => tap(area(a), fn, press(area(a)))
  m.titleTap = button(M.titleTap, () => back())
  m.upTap = button(M.upTap, () => scroll(-ROWS))
  m.downTap = button(M.downTap, () => scroll(ROWS))
  m.rows.forEach((r, i) => {
    r.tap = button(M.row[i].tap, () => act(i))
  })
  m.minusTap = button(M.minus, () => step((s) => s.dec))
  m.plusTap = button(M.plus, () => step((s) => s.inc))
  m.fineMinusTap = button(M.fineMinus, () => step((s) => s.fine.dec))
  m.finePlusTap = button(M.finePlus, () => step((s) => s.fine.inc))

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
