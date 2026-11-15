// Widget helpers shared by the pages: centred text, filled buttons, and the colours.
import { createWidget, widget, align, text_style } from '@zos/ui'

export const C = {
  dim: 0x8e8e93, white: 0xffffff, key: 0x2c2c2e, keyDown: 0x48484a, accent: 0x5e5ce6, accentDown: 0x7d7bf0,
  cell: 0x1c1c1e, best: 0x26235a, bestTime: 0xffd60a, bestDur: 0xc9c6ff, stop: 0xff453a, stopDown: 0xff6961, warn: 0xff9f0a,
}
export const text = (b, value, color, wrap = false) =>
  createWidget(widget.TEXT, { ...b, text: value, color, align_h: align.CENTER_H, align_v: align.CENTER_V, ...(wrap ? { text_style: text_style.WRAP } : {}) })
export const button = (b, value, click_func, normal_color = C.key, color = C.white, press_color = C.keyDown) =>
  createWidget(widget.BUTTON, { ...b, text: value, normal_color, press_color, color, click_func })
