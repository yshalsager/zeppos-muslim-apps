import { stub } from './zos-stub.mjs'
const [page = 'converter', lang = 'en', mode = '', params = '', width = '432', height = '514'] = process.argv.slice(2)
Object.assign(stub, { width: +width, height: +height, lang: lang === 'ar' ? 13 : 2 })
const { parseState } = await import('../lib/state.js')
const s = parseState('')
s.favourites = [{ from: 'kg', to: 'lb', value: 1 }]
s.recents = [{ from: 'us_cup', to: 'ml', value: 1 }, { from: 'pace_km', to: 'pace_mi', value: 5 }, { from: 'C', to: 'F', value: 20 }]
if (page === 'recent') s.recents = [
  { from: 'kg', to: 'lb', value: 1 }, { from: 'pace_km', to: 'pace_mi', value: 5 },
  { from: 'us_cup', to: 'ml', value: 1 }, { from: 'C', to: 'F', value: 20 },
  { from: 'gold_21', to: 'gold_24', value: 100 }, { from: 'dirham', to: 'sg', value: 1 },
  { from: 'sa', to: 'fkg', value: 1 }, { from: 'bar', to: 'psi', value: 1 },
  { from: 'kmL', to: 'l100', value: 20 }, { from: 'kcal', to: 'kJ', value: 1 },
]
if (mode === 'fitr' || mode === 'wheat') s.pair = { from: 'sa', to: 'fkg', value: 1 }
if (mode === 'wheat') s.settings.sa = 2.04
if (mode === 'volume') s.pair = { from: 'us_cup', to: 'ml', value: 1 }
if (mode === 'nisab') s.pair = { from: 'gold', to: 'ng', value: 1 }
if (mode === 'pace') s.pair = { from: 'pace_km', to: 'pace_mi', value: 5 }
if (mode === 'karats' || mode === 'indic') s.pair = { from: 'gold_21', to: 'gold_24', value: 100 }
if (mode === 'land') s.pair = { from: 'feddan', to: 'sqm', value: 1 }
if (mode === 'coins') s.pair = { from: 'dinar', to: 'ng', value: 20 }
if (mode === 'indic') s.settings.arabic_digits = true
if (mode === 'ingredients') s.pair = { from: 'i_cup', to: 'i_g', value: 1, ingredient: 'powdered_sugar' }
if (mode === 'fuel') s.pair = { from: 'kmL', to: 'l100', value: 20 }
if (mode === 'pressure') s.pair = { from: 'bar', to: 'psi', value: 1 }
if (mode === 'energy') s.pair = { from: 'kcal', to: 'kJ', value: 1 }
if (mode === 'oven') s.pair = { from: 'C', to: 'gas', value: 180 }
if (mode === 'crops') s.pair = { from: 'crops', to: 'fkg', value: 1 }
if (mode === 'kaffara') s.pair = { from: 'fast', to: 'fkg', value: 1 }
if (mode === 'mahr') s.pair = { from: 'mahr', to: 'sg', value: 1 }
if (mode === 'empty') { s.favourites = []; s.recents = [] }
stub.store.qistas = JSON.stringify(s)
await import(`../page/${page}.js`)
const def = stub.pages[0]
if (def.onInit) def.onInit(params)
def.build()
const out = stub.widgets.filter((w) => w.visible && (w.type !== 'IMG' || w.o.src)).map(({ type, o: { click_func, ...o } }) => ({ type, ...o }))
const content_height = Math.max(stub.height, ...out.map((w) => w.y + w.h))
if (mode === 'last') for (const w of out) w.y -= content_height - stub.height
console.log(JSON.stringify({ width: stub.width, height: stub.height, scrolling: stub.scroll_mode === 'FREE', content_height, widgets: out }))
