import { createWidget, deleteWidget, widget, align, text_style, event } from '@zos/ui'
import { setScrollMode, SCROLL_MODE_FREE } from '@zos/page'
import { L, lang } from './env'
export const C = { white: 0xffffff, dim: 0xb7babd, key: 0x24282c, down: 0x394047, accent: 0xb9e076, ink: 0x18230c }
export const text = (b, value, color = C.white) => createWidget(widget.TEXT, { ...b, text: value, color, align_h: align.CENTER_H, align_v: align.CENTER_V, text_style: text_style.WRAP })
export const button = (b, value, click_func, accent = false) => createWidget(widget.BUTTON, { ...b, text: value, click_func, normal_color: accent ? C.accent : C.key, press_color: C.down, color: accent ? C.ink : C.white })
export const icon = (b, name, click_func) => createWidget(widget.BUTTON, { ...b, normal_src: `icons/${name}.png`, press_src: `icons/${name}-press.png`, click_func })
export function clear(page) {
  for (const w of page.widgets || []) deleteWidget(w)
  page.widgets = []
}
const direction = (value) => lang === 'ar' && /^[-+٠-٩0-9A-Za-z]/.test(value) ? '\u200f' + value : value
export function list(page, title, entries) {
  clear(page)
  setScrollMode({ mode: SCROLL_MODE_FREE })
  page.widgets.push(text(L.title, title))
  entries.forEach((row, i) => {
    const caption = direction(row.text)
    const b = L.row(i)
    if (!caption.includes('\n')) return page.widgets.push(row.action ? button(b, caption, row.action, row.active) : text(b, caption, C.dim))
    if (row.action) page.widgets.push(createWidget(widget.FILL_RECT, { ...b, color: row.active ? C.accent : C.key }))
    const lines = caption.split('\n').map(direction)
    lines.forEach((line, j) => page.widgets.push(text({ ...b, x: b.x + 8, y: b.y + j * b.h / lines.length, w: b.w - 16, h: b.h / lines.length, ...(row.fit_detail && j === 1 ? { text_size: Math.max(1, Math.min(b.text_size, Math.floor((b.w - 16) / (line.length * .65)))) } : {}) }, line, row.active ? C.ink : C.white)))
    if (row.action) {
      const hit = createWidget(widget.IMG, b)
      hit.addEventListener(event.CLICK_UP, row.action)
      page.widgets.push(hit)
    }
  })
  // Extra scroll extent lets the last row reach the readable centre of a round screen.
  const last = L.row(Math.max(0, entries.length - 1))
  page.widgets.push(createWidget(widget.FILL_RECT, { x: 0, y: last.y + last.h + L.height / 2, w: 1, h: 1, color: 0 }))
}
