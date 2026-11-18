import { setStatusBarVisible } from '@zos/ui'
import { back } from '@zos/router'
import { T, ingredientLabel } from '../lib/env'
import { list } from '../lib/ui'
import { load, savePair } from '../lib/store'
import { INGREDIENTS } from '../lib/units'
Page({
  build() { setStatusBarVisible(false); this.render() },
  render() {
    const s = load()
    list(this, T.ingredient, INGREDIENTS.map(([id]) => ({ text: ingredientLabel(id), active: id === (s.pair.ingredient || 'flour'), action: () => {
      s.pair.ingredient = id
      savePair(s)
      back()
    } })))
  },
})
