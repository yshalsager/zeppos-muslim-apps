import { setStatusBarVisible } from '@zos/ui'
import { back } from '@zos/router'
import { T, fmt, optionLabel, lang } from '../lib/env'
import { list } from '../lib/ui'
import { load, save } from '../lib/store'
import { OPTIONS } from '../lib/units'
Page({
  onInit(id) { this.id = OPTIONS[id] ? id : 'qasr' },
  build() { setStatusBarVisible(false); this.render() },
  render() {
    const s = load(), id = this.id || 'qasr'
    list(this, id === 'poor_person' ? T.poor_title : T[id], OPTIONS[id].map((row) => ({ text: id === 'poor_person' ? optionLabel(row) : `${fmt(row[0])} ${id === 'qasr' || id === 'mil' ? lang === 'ar' ? 'كم' : 'km' : id === 'sa' ? lang === 'ar' ? 'كجم' : 'kg' : lang === 'ar' ? 'جرام' : 'g'}${optionLabel(row) ? ' · ' + optionLabel(row) : ''}`, active: s.settings[id] === row[0], action: () => {
      s.settings[id] = row[0]
      save(s)
      back()
    } })))
  },
})
