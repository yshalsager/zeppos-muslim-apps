import { setStatusBarVisible } from '@zos/ui'
import { push } from '@zos/router'
import { L, T, fmt, label, optionLabel, ingredientLabel } from '../lib/env'
import { clear, text, button, icon, C } from '../lib/ui'
import { load, save, savePair } from '../lib/store'
import { samePair, pin } from '../lib/state'
import { convert, unit, OPTIONS } from '../lib/units'
Page({
  build() { setStatusBarVisible(false); this.render() },
  onResume() { this.render() },
  render() {
    clear(this)
    this.s = load()
    const { from, to, value } = this.s.pair
    const category = unit(from).category
    const result = convert(value, from, to, this.s.settings, this.s.pair.ingredient)
    const cooking = category === 'ingredients'
    const input = fmt(value, from), output = fmt(result, to)
    this.widgets.push(text(L.title, T[category]),
      button({ ...L.value, text_size: Math.max(1, Math.min(L.value.text_size, Math.floor(L.value.w / (input.length * .65)))) }, input, () => push({ url: 'page/keypad' })),
      button(L.from, label(from), () => push({ url: 'page/units', params: 'from' })),
      icon(cooking ? L.ingredientSwap : L.swap, 'swap', () => { this.s.pair = { ...this.s.pair, from: to, to: from };  savePair(this.s); setTimeout(() => this.render(), 0) }),
      icon(cooking ? L.ingredientStar : L.favourite, this.s.favourites.some((p) => samePair(p, this.s.pair)) ? 'star-on' : 'star', () => { pin(this.s); save(this.s); setTimeout(() => this.render(), 0) }),
      text({ ...L.result, text_size: Math.max(1, Math.min(L.result.text_size, Math.floor(L.result.w / (output.length * .65)))) }, output, Number.isFinite(result) ? C.accent : C.dim),
      button(L.to, label(to), () => push({ url: 'page/units', params: 'to' })))
    if (cooking) this.widgets.push(button(L.ingredient, ingredientLabel(this.s.pair.ingredient), () => push({ url: 'page/ingredients' })))
    const note = category === 'fitr' ? ([2.5, 2.04, 2.1].includes(this.s.settings.sa) ? optionLabel(OPTIONS.sa.find(([v]) => v === this.s.settings.sa)) : '') : Number.isFinite(result) ? T.edit : T.invalid
    this.widgets.push(text(L.note, note, C.dim))
    savePair(this.s)
  },
})
