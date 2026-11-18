import { setStatusBarVisible } from '@zos/ui'
import { back, push } from '@zos/router'
import { T, pairText } from '../lib/env'
import { list } from '../lib/ui'
import { load, save } from '../lib/store'
Page({
  build() { setStatusBarVisible(false); this.render() },
  onResume() { this.render() },
  render() {
    const s = load()
    list(this, T.recents, [
      ...s.recents.map((pair) => ({ text: pairText(pair), action: () => {
        s.pair = { ...pair }
        save(s)
        push({ url: 'page/converter' })
      } })),
      { text: T.clear, action: () => { s.recents = []; save(s); back() } },
    ])
  },
})
