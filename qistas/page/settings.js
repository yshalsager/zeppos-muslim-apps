import { setStatusBarVisible } from '@zos/ui'
import { push } from '@zos/router'
import { T, fmt, optionLabel } from '../lib/env'
import { list } from '../lib/ui'
import { load, save } from '../lib/store'
import { OPTIONS } from '../lib/units'
Page({
  build() { setStatusBarVisible(false); this.render() },
  onResume() { this.render() },
  render() {
    const s = load()
    const rows = Object.entries(OPTIONS).map(([id, rows]) => {
      const label = optionLabel(rows.find(([v]) => v === s.settings[id]))
      return { text: `${T[id]}${id === 'poor_person' ? '' : ': ' + fmt(s.settings[id])}${label ? '\n' + label : ''}`, action: () => push({ url: 'page/opinions', params: id }) }
    })
    rows.push({ text: `${T.arabic_digits}\n${s.settings.arabic_digits ? T.on : T.off}`, action: () => {
      s.settings.arabic_digits = !s.settings.arabic_digits
      save(s)
      setTimeout(() => this.render(), 0)
    } })
    list(this, T.settings, rows)
  },
})
