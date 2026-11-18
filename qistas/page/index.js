import { setStatusBarVisible } from '@zos/ui'
import { push } from '@zos/router'
import { T, pairText, pairSummary } from '../lib/env'
import { list } from '../lib/ui'
import { load, save } from '../lib/store'
import { CATEGORIES, PAIRS, unit } from '../lib/units'

Page({
  build() { setStatusBarVisible(false); this.render() },
  onResume() { this.render() },
  open(pair) { const s = load(); s.pair = { ...pair }; save(s); push({ url: 'page/converter' }) },
  category(id) {
    if (id === 'islamic') return push({ url: 'page/islamic' })
    const [from, to] = PAIRS[id]
    const last = load().pair
    this.open(unit(last.from).category === id ? last : { from, to, value: 1 })
  },
  render() {
    const s = load()
    const pairRow = (p) => ({ text: pairText(p), action: () => this.open(p) })
    const entries = [
      ...(s.recents.length ? [{ text: `${T.recents}\n${pairSummary(s.recents[0])}`, fit_detail: true, action: () => push({ url: 'page/recent' }) }] : []),
      ...(s.favourites.length ? [{ text: T.favourites }, ...s.favourites.map(pairRow)] : []),
      ...CATEGORIES.map((id) => ({ text: T[id], action: () => this.category(id) })),
      { text: T.settings, action: () => push({ url: 'page/settings' }) },
    ]
    list(this, T.title, entries)
  },
})
