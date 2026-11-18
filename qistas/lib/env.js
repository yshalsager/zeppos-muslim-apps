import { getDeviceInfo } from '@zos/device'
import { getLanguage } from '@zos/settings'
import { STRINGS, langOf, localized } from './i18n'
import { layout } from './layout'
import { digits, format, unit, INGREDIENTS } from './units'
import { load } from './store'
const { width, height } = getDeviceInfo()
export const lang = langOf(getLanguage())
export const T = STRINGS[lang]
export const L = layout(width, height, lang === 'ar')
export const num = (v) => digits(v, load().settings.arabic_digits)
export const fmt = (v, id) => format(v, load().settings.arabic_digits, id)
export const label = (id) => num(localized(unit(id).en, unit(id).ar, lang))
export const ingredientLabel = (id = 'flour') => { const row = INGREDIENTS.find(([key]) => key === id) || INGREDIENTS[0]; return localized(row[2], row[3], lang) }
export const optionLabel = (row) => num(localized(row[1], row[2], lang))
export const pairText = (p) => unit(p.from).category === 'ingredients' ? `${fmt(p.value)} ${ingredientLabel(p.ingredient)}\n${label(p.from)} / ${label(p.to)}` : `${fmt(p.value, p.from)} ${label(p.from)}\n${label(p.to)}`
export const pairSummary = (p) => `${fmt(p.value, p.from)} ${label(p.from)} ${T.to} ${label(p.to)}`
