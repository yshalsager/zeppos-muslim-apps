import { setStatusBarVisible, prop } from '@zos/ui'
import { push } from '@zos/router'
import { lang, T, L } from '../lib/env'
import { load, save } from '../lib/store'
import { step, localize } from '../lib/sleep'
import { C, text, button } from '../lib/ui'

const KEYS = ['cycle', 'fall', 'clock', 'mode', 'snooze']
const S = L.settings

Page({
  build() {
    setStatusBarVisible(false)
    this.s = load()
    this.values = KEYS.map((k, i) => {
      const r = S.rows[i]
      text(r.label, T.rows[k], C.dim)
      button(r.minus, '-', () => this.change(k, -1))
      button(r.plus, '+', () => this.change(k, 1))
      return text(r.value, this.label(k), C.white)
    })
    // sets a real alarm a minute from now: how to check alarms work on this watch
    button(S.test, T.test, () => push({ url: 'page/alarm', params: JSON.stringify({ test: 1 }) }), C.accent, C.white, C.accentDown)
  },

  label(k) {
    const v = this.s[k]
    if (k === 'clock') return T.clocks[v]
    if (k === 'mode') return T.tabs[v]
    return localize(T.minutes(v), lang)
  },

  change(k, d) {
    this.s[k] = step[k](this.s[k], d)
    save(this.s)
    this.values[KEYS.indexOf(k)].setProperty(prop.TEXT, this.label(k))
  },
})
