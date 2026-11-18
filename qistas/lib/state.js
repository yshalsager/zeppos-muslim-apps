import { DEFAULTS, OPTIONS, unit, INGREDIENTS } from './units.js'
export const initialPair = () => ({ from: 'm', to: 'ft', value: 1 })
export function validPair(p) {
  return p && unit(p.from) && unit(p.to)?.category === unit(p.from).category && Number.isFinite(p.value) && (p.ingredient === undefined || INGREDIENTS.some(([id]) => id === p.ingredient))
}
export function parseState(raw) {
  let s
  try { s = JSON.parse(raw) } catch { s = {} }
  s = s && typeof s === 'object' ? s : {}
  const settings = { ...Object.fromEntries(Object.entries(OPTIONS).map(([key, rows]) => [key, rows.some(([v]) => v === s.settings?.[key]) ? s.settings[key] : DEFAULTS[key]])), arabic_digits: s.settings?.arabic_digits === true }
  return { settings, pair: validPair(s.pair) ? s.pair : initialPair(), favourites: Array.isArray(s.favourites) ? s.favourites.filter(validPair) : [], recents: Array.isArray(s.recents) ? s.recents.filter(validPair).slice(0, 10) : [] }
}
export const samePair = (a, b) => a.from === b.from && a.to === b.to && (unit(a.from).category !== 'ingredients' || (a.ingredient || 'flour') === (b.ingredient || 'flour'))
export function remember(s) {
  s.recents = [{ ...s.pair }, ...s.recents.filter((p) => !samePair(p, s.pair))].slice(0, 10)
}
export function pin(s) {
  const i = s.favourites.findIndex((p) => samePair(p, s.pair))
  if (i >= 0) s.favourites.splice(i, 1)
  else s.favourites.push({ ...s.pair })
}
