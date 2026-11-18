import { setStatusBarVisible } from '@zos/ui'
import { back } from '@zos/router'
import { T, label } from '../lib/env'
import { list } from '../lib/ui'
import { load, savePair } from '../lib/store'
import { units, unit } from '../lib/units'
Page({
  onInit(side) { this.side = side === 'to' ? 'to' : 'from' },
  build() { setStatusBarVisible(false); this.render() },
  render() {
    const s = load(), side = this.side || 'from'
    list(this, T.choose, units(unit(s.pair[side]).category).map((u) => ({ text: label(u.id), active: u.id === s.pair[side], action: () => { s.pair[side] = u.id; savePair(s); back() } })))
  },
})
