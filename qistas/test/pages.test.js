import { test, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { stub } from '../tools/zos-stub.mjs'
import { parseState } from '../lib/state.js'
for (const page of ['index', 'converter', 'keypad', 'units', 'islamic', 'settings', 'opinions', 'ingredients', 'recent']) await import(`../page/${page}.js`)
const [home, converter, keypad, picker, islamic, settings, opinions, ingredients, recent] = stub.pages
const shown = () => stub.widgets.filter((w) => w.visible)
const texts = () => shown().map((w) => w.o.text).filter((t) => typeof t === 'string')
const tap = (value) => {
  const image = { '↑↓': 'swap', '☆': 'star', '★': 'star-on', '⌫': 'delete' }[value]
  const w = shown().find((w) => image ? w.o.normal_src === `icons/${image}.png` : w.o.text === value)
  assert.ok(w, `missing button ${value}: ${texts()}`)
  if (w.type === 'BUTTON') return w.o.click_func()
  const hit = shown().find((h) => h.type === 'IMG' && h.o.x <= w.o.x && h.o.y <= w.o.y && h.o.y + h.o.h >= w.o.y + w.o.h)
  assert.ok(hit, `missing hit target ${value}`)
  hit.listeners.CLICK_UP()
}
const open = (page, params) => { stub.widgets = []; page.widgets = []; if (page.onInit) page.onInit(params); page.build() }
const state = () => JSON.parse(stub.store.qistas)
beforeEach(() => Object.assign(stub, { widgets: [], store: { qistas: JSON.stringify(parseState('')) }, pushed: null, backed: false }))

test('home exposes categories, settings and last pair', () => {
  open(home)
  tap('Length'); assert.equal(stub.pushed.url, 'page/converter')
  let s = state(); s.pair = { from: 'in', to: 'cm', value: 7 }; stub.store.qistas = JSON.stringify(s)
  open(home); tap('Length'); assert.deepEqual(state().pair, s.pair)
  tap('Settings'); assert.equal(stub.pushed.url, 'page/settings')
})
test('keypad opens pre-filled, edits a signed decimal, commits and updates result', () => {
  open(converter); tap('1'); assert.equal(stub.pushed.url, 'page/keypad')
  open(keypad); assert.equal(keypad.value, '1')
  for (const key of ['⌫', '7', '.', '5', '+/-']) tap(key)
  assert.equal(keypad.value, '-7.5'); tap('OK')
  assert.ok(stub.backed); assert.equal(state().pair.value, -7.5)
  open(converter); assert.ok(texts().includes('-24.6063'))
  assert.equal(state().recents[0].value, -7.5)
})
test('discarding keypad changes leaves the saved value untouched', () => {
  open(keypad); tap('7'); assert.equal(state().pair.value, 1)
})
test('swap preserves entered value and reverses units', () => {
  open(converter); tap('↑↓')
  assert.deepEqual(state().pair, { from: 'ft', to: 'm', value: 1 })
  assert.ok(texts().includes('0.3048'))
  tap('↑↓'); assert.equal(state().pair.from, 'm')
})
test('favourites toggle, survive reopening and open from home', () => {
  open(converter); tap('☆'); assert.equal(state().favourites.length, 1)
  open(converter); assert.ok(shown().some((w) => w.o.normal_src === 'icons/star-on.png'))
  open(home); tap('1 Metre'); assert.equal(stub.pushed.url, 'page/converter')
  open(converter); tap('★'); assert.equal(state().favourites.length, 0)
})
test('scrolling unit picker changes only the selected side and saves recents', () => {
  open(converter); tap('Metre'); assert.deepEqual(stub.pushed, { url: 'page/units', params: 'from' })
  open(picker, 'from'); tap('Inch')
  assert.ok(stub.backed); assert.equal(state().pair.from, 'in'); assert.equal(state().pair.to, 'ft')
  open(converter); tap('Foot'); open(picker, 'to'); tap('Centimetre')
  assert.equal(state().pair.to, 'cm'); assert.equal(state().recents.length, 3)
})
test('Islamic groups and settings use short labels and grain-only footnotes', () => {
  open(islamic); tap('Saʿ & mudd'); assert.deepEqual(state().pair, { from: 'sa', to: 'fkg', value: 1 })
  open(converter); assert.ok(texts().includes('2.5') && texts().includes('Rice'))
  open(settings); tap('Saʿ · kg: 2.5'); assert.deepEqual(stub.pushed, { url: 'page/opinions', params: 'sa' })
  open(opinions, 'sa'); tap('3 kg · Precaution'); assert.equal(state().settings.sa, 3)
  open(converter); assert.ok(texts().includes('3') && !texts().includes('Rice') && !texts().includes('Wheat') && !texts().includes('Precaution'))
  open(opinions, 'gold'); tap('87.48 g · Hanafi'); assert.equal(state().settings.gold, 87.48)
  open(opinions, 'silver'); tap('612.36 g · Hanafi'); assert.equal(state().settings.silver, 612.36)
  open(opinions, 'mil'); tap('1.92 km'); assert.equal(state().settings.mil, 1.92)
})
test('qasr stays a distance unit and its opinion changes only through Settings', () => {
  open(islamic)
  assert.deepEqual(texts(), ['Islamic measures', 'Gold', 'Silver', 'Saʿ & mudd', 'Islamic distances'])
  tap('Islamic distances')
  assert.deepEqual(state().pair, { from: 'qasr', to: 'dkm', value: 1 })
  open(converter); assert.ok(texts().includes('80.64'))
  open(keypad); tap('⌫'); tap('2'); tap('OK')
  open(settings); tap('Qasr · km: 80.64')
  assert.deepEqual(stub.pushed, { url: 'page/opinions', params: 'qasr' })
  stub.backed = false
  open(opinions, 'qasr')
  assert.deepEqual(texts().slice(1), ['80.64 km · Majority', '80 km · Majority', '81 km · Hanafi', '88.8 km · Hanafi', '77 km · Hanafi (approx.)'])
  tap('88.8 km · Hanafi'); assert.equal(state().settings.qasr, 88.8)
  assert.ok(stub.backed)
  assert.deepEqual(stub.pushed, { url: 'page/opinions', params: 'qasr' })
  assert.deepEqual(state().pair, { from: 'qasr', to: 'dkm', value: 2 })
  open(converter); assert.ok(texts().includes('177.6'))
})
test('home orders its single Recent shortcut, favourites and categories in every saved-data state', () => {
  for (const has_recents of [false, true]) for (const has_favourites of [false, true]) {
    const s = parseState('')
    if (has_recents) s.recents = [{ from: 'm', to: 'ft', value: 2 }, { from: 'C', to: 'F', value: 20 }]
    if (has_favourites) s.favourites = [{ from: 'kg', to: 'lb', value: 1 }]
    stub.store.qistas = JSON.stringify(s)
    open(home)
    const expected = ['Qistas', ...(has_recents ? ['Recent', '2 Metre to Foot'] : []), ...(has_favourites ? ['Favourites', '1 Kilogram', 'Pound'] : []), 'Length']
    assert.deepEqual(texts().slice(0, expected.length), expected)
    assert.ok(!texts().includes('2 Metre') && !texts().includes('20 Celsius °C'))
    assert.equal(texts().filter((t) => t === 'Recent').length, has_recents ? 1 : 0)
    if (has_recents) { tap('Recent'); assert.equal(stub.pushed.url, 'page/recent') }
  }
})
test('Recent lists the latest ten pairs, opens one and updates newest-first order on return', () => {
  const pairs = [...['m', 'cm', 'in', 'yd', 'mi', 'mm', 'ft', 'km'].map((from) => [from, 'ft']), ...['kg', 'g', 'oz', 'st'].map((from) => [from, 'lb'])]
  pairs.forEach(([from, to], i) => {
    const s = parseState(stub.store.qistas)
    s.pair = { from, to, value: i + 1 }
    stub.store.qistas = JSON.stringify(s)
    open(converter)
  })
  assert.equal(state().recents.length, 10)
  assert.deepEqual(state().recents.map((p) => p.from), pairs.slice(2).reverse().map(([from]) => from))
  open(home); tap('Recent'); open(recent)
  assert.deepEqual(texts().slice(0, 3), ['Recent', '12 Stone', 'Pound'])
  assert.equal(texts().at(-1), 'Clear')
  tap('10 Gram'); assert.deepEqual(state().pair, { from: 'g', to: 'lb', value: 10 })
  assert.equal(stub.pushed.url, 'page/converter')
  open(converter); stub.widgets = []; recent.onResume()
  assert.deepEqual(texts().slice(0, 3), ['Recent', '10 Gram', 'Pound'])
  assert.equal(state().recents.length, 10)
})
test('opening an ingredient recent preserves its ingredient and density', () => {
  stub.store.qistas = JSON.stringify({ recents: [{ from: 'i_cup', to: 'i_g', value: 1, ingredient: 'honey' }] })
  open(recent); tap('1 Honey')
  assert.deepEqual(state().pair, { from: 'i_cup', to: 'i_g', value: 1, ingredient: 'honey' })
  open(converter); assert.ok(texts().includes('336') && texts().includes('Honey'))
})
test('Clear empties only recent history and returns home with its shortcut hidden', () => {
  const s = parseState('')
  s.recents = [{ from: 'm', to: 'ft', value: 2 }]
  s.favourites = [{ from: 'kg', to: 'lb', value: 1 }]
  stub.store.qistas = JSON.stringify(s)
  open(recent); tap('Clear')
  assert.ok(stub.backed)
  assert.deepEqual(state().recents, [])
  assert.deepEqual(state().favourites, s.favourites)
  assert.deepEqual(state().pair, s.pair)
  assert.deepEqual(state().settings, s.settings)
  open(home); assert.ok(!texts().includes('Recent'))
  assert.deepEqual(texts().slice(0, 5), ['Qistas', 'Favourites', '1 Kilogram', 'Pound', 'Length'])
})
test('fresh home starts with categories and every item belongs to one native scrolling list', () => {
  open(home)
  assert.equal(stub.scroll_mode, 'FREE')
  assert.deepEqual(texts().slice(0, 4), ['Qistas', 'Length', 'Weight', 'Cooking volume'])
  assert.ok(!texts().includes('Favourites') && !texts().includes('Recent') && !texts().includes('Next'))
  const actions = shown().filter((w) => w.type === 'BUTTON')
  assert.ok(actions.at(-1).o.y > stub.height)
  tap('Settings'); assert.equal(stub.pushed.url, 'page/settings')
  tap('Length'); assert.equal(stub.pushed.url, 'page/converter')
})
test('pace keypad uses m:ss, validates seconds and stores numeric minutes with m:ss recents', () => {
  const s = parseState(''); s.pair = { from: 'pace_km', to: 'pace_mi', value: 5 }; stub.store.qistas = JSON.stringify(s)
  open(converter); assert.ok(texts().includes('5:00') && texts().includes('8:03'))
  assert.ok(!texts().includes('Pace: decimal minutes'))
  tap('5:00'); open(keypad)
  assert.equal(keypad.value, '5:00'); assert.ok(texts().includes(':') && !texts().includes('.'))
  for (const k of ['⌫', '⌫', '6', '0']) tap(k)
  tap('OK'); assert.ok(!stub.backed); assert.ok(texts().includes('Seconds: 0–59'))
  assert.equal(state().pair.value, 5)
  for (const k of ['⌫', '⌫', '3', '0']) tap(k)
  tap('OK'); assert.ok(stub.backed); assert.equal(state().pair.value, 5.5)
  open(converter); assert.ok(texts().includes('5:30') && texts().includes('8:51'))
  open(home); assert.ok(texts().includes('5:30 Minutes / km to Minutes / mile'))
  open(recent); assert.ok(texts().includes('5:30 Minutes / km'))
})
test('settings and all opinion lists omit source names and methods', () => {
  open(settings)
  assert.equal(texts().filter((t) => t === 'Majority').length, 3)
  assert.ok(texts().includes('Mil · km: 1.68'))
  for (const id of ['gold', 'silver', 'sa', 'mil', 'qasr']) {
    open(opinions, id)
    assert.ok(!texts().some((t) => /Jubair|Uthaymeen|Baz|Ifta|Portal|Committee|Charity|8831|cubits|tola|mithqal|dirham/i.test(t)))
    if (id === 'mil') assert.deepEqual(texts().slice(1), ['1.68 km', '1.85 km', '1.92 km'])
    if (id === 'sa') assert.deepEqual(texts().slice(1), ['2.5 kg · Rice', '2.04 kg · Wheat', '2.1 kg · Rice', '3 kg · Precaution', '3.25 kg · Hanafi (Egypt)', '3.18 kg · Hanafi (South Asia)'])
  }
})
test('Egyptian land units are reachable from Area and convert to square metres', () => {
  open(home); tap('Area'); open(converter); tap('Square metre')
  open(picker, 'from'); tap('Feddan')
  open(picker, 'to'); assert.ok(texts().includes('Qirat (land)') && texts().includes('Sahm')); tap('Square metre')
  open(converter); assert.ok(texts().includes('4200.83'))
})
test('gold group opens on 21k to 24k and can show the selected nisab fraction', () => {
  open(islamic); tap('Gold')
  assert.deepEqual(state().pair, { from: 'gold_21', to: 'gold_24', value: 1 })
  open(keypad); tap('0'); tap('0'); tap('OK')
  open(converter); assert.ok(texts().includes('100') && texts().includes('87.5'))
  open(picker, 'to'); assert.ok(texts().includes('Islamic dinar') && !texts().includes('Islamic dirham')); tap('Gold nisab')
  open(converter); assert.ok(texts().includes('1.02941'))
})
test('Silver defaults to dirham-to-gram and never offers gold units', () => {
  open(islamic); tap('Silver')
  assert.deepEqual(state().pair, { from: 'dirham', to: 'sg', value: 1 })
  open(converter); assert.ok(texts().includes('2.975') && texts().includes('Silver'))
  open(picker, 'from')
  for (const name of ['Gram', 'Islamic dirham', 'Uqiyah', 'Tola', 'Silver nisab', 'Sunnah mahr']) assert.ok(texts().includes(name))
  for (const name of ['Gold nisab', 'Gram 21k', 'Mithqal', 'Islamic dinar']) assert.ok(!texts().includes(name))
  tap('Sunnah mahr'); open(converter); assert.ok(texts().includes('1487.5'))
})
test('home drops legacy mixed-metal favourites and safely opens a valid silver favourite', () => {
  const invalid = { from: 'mahr', to: 'gold', value: 1 }
  stub.store.qistas = JSON.stringify({ pair: invalid, favourites: [invalid, { from: 'dirham', to: 'silver', value: 200 }] })
  open(home); assert.ok(!texts().some((t) => t.includes('Sunnah mahr')))
  tap('200 Islamic dirham'); open(converter)
  assert.ok(texts().includes('Silver') && texts().includes('1'))
})
test('Arabic-Indic preference also applies in English and can be disabled', () => {
  stub.store.qistas = JSON.stringify({ pair: { from: 'gold_21', to: 'gold_24', value: 100 } })
  open(settings); tap('Arabic-Indic digits')
  assert.equal(state().settings.arabic_digits, true)
  open(converter); assert.ok(texts().includes('١٠٠') && texts().includes('Gram ٢١k'))
  open(keypad); assert.equal(keypad.display.o.text, '١٠٠'); assert.ok(texts().includes('٧') && texts().includes('٫'))
  open(settings); tap('Arabic-Indic digits')
  assert.equal(state().settings.arabic_digits, false)
  open(converter); assert.ok(texts().includes('100') && texts().includes('Gram 21k'))
})
test('ingredient picker changes density and favourites/recents preserve the ingredient through swap', () => {
  open(home); tap('Ingredients'); open(converter)
  assert.ok(texts().includes('120') && texts().includes('Flour'))
  tap('Flour'); assert.equal(stub.pushed.url, 'page/ingredients')
  open(ingredients); tap('Honey'); open(converter)
  assert.ok(texts().includes('336') && texts().includes('Honey'))
  tap('☆'); tap('↑↓')
  assert.equal(state().pair.ingredient, 'honey')
  assert.equal(state().pair.from, 'i_g')
  open(ingredients); tap('Flour'); open(converter); tap('☆')
  assert.equal(state().favourites.length, 2)
  open(home); tap('1 Honey')
  assert.equal(state().pair.ingredient, 'honey')
  assert.equal(state().pair.from, 'i_cup')
})
test('food-per-person setting changes fidya and kaffara without resetting the pair', () => {
  stub.store.qistas = JSON.stringify({ pair: { from: 'fast', to: 'fkg', value: 1 } })
  open(converter); assert.ok(texts().includes('37.5'))
  open(settings); tap('Food per poor person')
  assert.deepEqual(stub.pushed, { url: 'page/opinions', params: 'poor_person' })
  open(opinions, 'poor_person'); tap('Hanafi · half saʿ')
  assert.equal(state().settings.poor_person, .5)
  open(converter); assert.ok(texts().includes('75'))
})
test('fuel zero and oven range failures display a dash', () => {
  for (const pair of [{ from: 'kmL', to: 'l100', value: 0 }, { from: 'C', to: 'gas', value: 100 }]) {
    stub.store.qistas = JSON.stringify({ pair }); open(converter)
    assert.ok(texts().includes('—') && texts().includes('Outside valid range'))
  }
})
test('invalid absolute temperature is visible instead of an invented result', () => {
  const s = parseState(''); s.pair = { from: 'K', to: 'C', value: -1 }; stub.store.qistas = JSON.stringify(s)
  open(converter); assert.ok(texts().includes('—') && texts().includes('Outside valid range'))
})
