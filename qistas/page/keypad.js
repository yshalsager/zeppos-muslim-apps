import { prop, setStatusBarVisible } from '@zos/ui'
import { back } from '@zos/router'
import { L, T, num } from '../lib/env'
import { clear, text, button, icon } from '../lib/ui'
import { load, savePair } from '../lib/store'
import { editNumber, pace, parsePace, decimal, format } from '../lib/units'
Page({
  build() {
    setStatusBarVisible(false)
    clear(this)
    this.s = load()
    this.is_pace = pace(this.s.pair.from)
    this.value = this.is_pace ? format(this.s.pair.value, false, this.s.pair.from) : decimal(this.s.pair.value)
    this.title = text(L.title, T.input)
    this.widgets.push(this.title)
    this.display = text({ ...L.input, text_size: Math.round(L.input.text_size * (this.value.length > 10 ? .7 : 1)) }, num(this.value))
    this.widgets.push(this.display)
    for (const b of L.keys) {
      const key = b.key === '.' && this.is_pace ? ':' : b.key
      this.widgets.push(key === '⌫' ? icon(b, 'delete', () => this.key(key)) : button(b, key === 'OK' ? T.ok : num(key), () => this.key(key), key === 'OK'))
    }
  },
  key(key) {
    if (key === 'OK') {
      const value = this.is_pace ? parsePace(this.value) : Number(this.value)
      if (!Number.isFinite(value)) return this.title.setProperty(prop.TEXT, this.is_pace ? num(T.seconds) : T.invalid)
      this.s.pair.value = value
      savePair(this.s)
      return back()
    }
    this.title.setProperty(prop.TEXT, T.input)
    this.value = editNumber(this.value, key, this.is_pace ? ':' : '.')
    this.display.setProperty(prop.MORE, { text: num(this.value), text_size: Math.round(L.input.text_size * (this.value.length > 10 ? .7 : 1)) })
  },
})
