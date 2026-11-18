import { setStatusBarVisible } from '@zos/ui'
import { push } from '@zos/router'
import { T } from '../lib/env'
import { list } from '../lib/ui'
import { load, save } from '../lib/store'
import { PAIRS, unit } from '../lib/units'
Page({
  build() { setStatusBarVisible(false); this.render() },
  render() {
    list(this, T.islamic, ['gold_mass', 'silver_mass', 'fitr', 'distance'].map((id) => ({ text: T[id], action: () => {
      const s = load(), [from, to] = PAIRS[id]
      if (unit(s.pair.from).category !== id) s.pair = { from, to, value: 1 }
      save(s)
      push({ url: 'page/converter' })
    } })))
  },
})
