import { test } from 'node:test'
import assert from 'node:assert/strict'
import { UNITS, DEFAULTS, OPTIONS, factor, convert, format, digits, editNumber, parsePace, decimal, INGREDIENTS, GAS_MARKS } from '../lib/units.js'
import { parseState, remember, pin } from '../lib/state.js'
import { langOf } from '../lib/i18n.js'
const near = (a, b) => assert.ok(Math.abs(a - b) <= Math.max(1e-10, Math.abs(b) * 1e-12), `${a} ≠ ${b}`)
import { exact, ingredient_weights, gas_table } from './definitions.js'
for (const u of UNITS) test(`definition: ${u.id}`, () => near(factor(u.id), exact[u.id]))
test('exact international and cooking examples', () => {
  near(convert(1, 'in', 'cm'), 2.54)
  near(convert(1, 'lb', 'kg'), .45359237)
  near(convert(1, 'us_cup', 'ml'), 236.5882365)
  near(convert(1, 'imp_pint', 'ml'), 568.26125)
  near(convert(1, 'imp_cup', 'ml'), 284.130625)
  near(convert(1, 'metric_cup', 'ml'), 250)
  near(convert(3, 'us_tsp', 'us_tbsp'), 1)
  near(convert(3, 'tsp', 'tbsp'), 1)
})
test('Egyptian land units retain the supplied rounded metric definitions', () => {
  near(convert(1, 'feddan', 'sqm'), 4200.83)
  near(convert(1, 'qirat', 'sqm'), 175.035)
  near(convert(1, 'sahm', 'sqm'), 7.293)
  assert.ok(Math.abs(convert(1, 'feddan', 'qirat') - 24) < .0001)
  assert.ok(Math.abs(convert(1, 'feddan', 'sahm') - 576) < .01)
  assert.ok(Math.abs(convert(1, 'qirat', 'sahm') - 24) < .001)
  near(convert(1, 'feddan', 'acre'), 4200.83 / 4046.8564224)
  near(convert(convert(1, 'feddan', 'acre'), 'acre', 'feddan'), 1)
})
test('gold karat weights convert through pure gold and the selected nisab', () => {
  for (const karat of [24, 22, 21, 18, 14, 12, 9]) near(convert(100, `gold_${karat}`, 'gold_24'), 100 * karat / 24)
  near(convert(100, 'gold_21', 'gold_24'), 87.5)
  near(convert(100, 'gold_21', 'gold'), 87.5 / 85)
  near(convert(100, 'gold_21', 'gold', { gold: 87.48 }), 87.5 / 87.48)
  near(convert(85, 'gold_24', 'gold'), 1)
})
test('Islamic dinar and dirham reproduce their nisab counts', () => {
  near(convert(1, 'dinar', 'mithqal'), 1)
  near(convert(20, 'dinar', 'ng'), 85)
  near(convert(200, 'dirham', 'sg'), 595)
  near(convert(20, 'dinar', 'gold'), 1)
  near(convert(200, 'dirham', 'silver'), 1)
})
test('crop measures follow every selected sa mass', () => {
  for (const [sa] of OPTIONS.sa) {
    near(convert(1, 'wasq', 'sa', { sa }), 60)
    near(convert(1, 'crops', 'wasq', { sa }), 5)
    near(convert(1, 'crops', 'fkg', { sa }), sa * 300)
  }
  near(convert(1, 'crops', 'fkg'), 750)
})
test('uqiyah and Sunnah mahr retain their silver dirham counts', () => {
  near(convert(1, 'uqiyah', 'dirham'), 40)
  near(convert(1, 'uqiyah', 'sg'), 119)
  near(convert(1, 'mahr', 'dirham'), 500)
  near(convert(1, 'mahr', 'sg'), 1487.5)
})
test('fidya and kaffara follow both the sa and per-person settings', () => {
  for (const [sa] of OPTIONS.sa) for (const [poor_person] of OPTIONS.poor_person) {
    const s = { sa, poor_person }
    near(convert(1, 'fidya', 'fkg', s), sa * poor_person)
    near(convert(1, 'oath', 'fidya', s), 10)
    near(convert(1, 'fast', 'fidya', s), 60)
    near(convert(1, 'oath', 'fkg', s), sa * poor_person * 10)
    near(convert(1, 'fast', 'fkg', s), sa * poor_person * 60)
  }
  near(convert(1, 'oath', 'fkg'), 6.25)
  near(convert(1, 'fast', 'fkg', { sa: 3.25, poor_person: .5 }), 97.5)
})
test('ingredient chart entries and every cup/spoon/weight conversion', () => {
  assert.deepEqual(Object.fromEntries(INGREDIENTS.map(([id, grams]) => [id, grams])), ingredient_weights)
  for (const [id, grams] of INGREDIENTS) {
    near(convert(1, 'i_cup', 'i_g', DEFAULTS, id), grams)
    near(convert(1, 'i_metric', 'i_g', DEFAULTS, id), grams * 250 / 236.5882365)
    near(convert(16, 'i_tbsp', 'i_cup', DEFAULTS, id), 1)
    near(convert(48, 'i_tsp', 'i_cup', DEFAULTS, id), 1)
    near(convert(1, 'i_oz', 'i_g', DEFAULTS, id), 28.349523125)
    for (const a of UNITS.filter((u) => u.category === 'ingredients')) for (const b of UNITS.filter((u) => u.category === 'ingredients')) near(convert(convert(2, a.id, b.id, DEFAULTS, id), b.id, a.id, DEFAULTS, id), 2)
  }
})
test('fuel economy reciprocal definitions and zero guards', () => {
  near(convert(20, 'kmL', 'l100'), 5)
  near(convert(5, 'l100', 'kmL'), 20)
  near(convert(1, 'mpg_us', 'kmL'), 1.609344 / 3.785411784)
  near(convert(1, 'mpg_uk', 'kmL'), 1.609344 / 4.54609)
  for (const [from, to] of [['l100', 'kmL'], ['kmL', 'l100'], ['l100', 'l100']]) assert.ok(Number.isNaN(convert(0, from, to)))
  assert.ok(Number.isNaN(convert(-1, 'kmL', 'mpg_us')))
  near(convert(0, 'kmL', 'mpg_us'), 0)
})
test('pressure and thermochemical food energy definitions', () => {
  near(convert(1, 'bar', 'kPa'), 100)
  near(convert(1, 'atm', 'kPa'), 101.325)
  near(convert(1, 'psi', 'kPa'), 6.894757293168)
  near(convert(1, 'kcal', 'kJ'), 4.184)
  near(convert(1, 'kWh', 'kJ'), 3600)
})
test('UK oven gas table, nearest mark with upward ties and strict range edges', () => {
  assert.deepEqual(GAS_MARKS, gas_table)
  for (const [mark, c, f] of GAS_MARKS) {
    near(convert(mark, 'gas', 'C'), c); near(convert(mark, 'gas', 'F'), f)
    near(convert(c, 'C', 'gas'), mark); near(convert(f, 'F', 'gas'), mark)
  }
  near(convert(170, 'C', 'gas'), 4); near(convert(337.5, 'F', 'gas'), 4)
  near(convert(110, 'C', 'gas'), .25); near(convert(240, 'C', 'gas'), 9)
  near(convert(383.15, 'K', 'gas'), .25)
  for (const [v, from, to] of [[109.9, 'C', 'gas'], [240.1, 'C', 'gas'], [224, 'F', 'gas'], [476, 'F', 'gas'], [.3, 'gas', 'C']]) assert.ok(Number.isNaN(convert(v, from, to)))
})
test('Egyptian weight and dry-volume definitions', () => {
  near(convert(1, 'ratl', 'g'), 449.28); near(convert(1, 'oqqa', 'kg'), 1.248)
  near(convert(1, 'kantar', 'ratl'), 100); near(convert(1, 'kantar', 'kg'), 44.928)
  near(convert(1, 'ardeb', 'L'), 198); near(convert(12, 'kila', 'ardeb'), 1)
  near(convert(96, 'qadah', 'ardeb'), 1)
})
test('temperature affine transforms and absolute zero', () => {
  near(convert(32, 'F', 'C'), 0); near(convert(100, 'C', 'F'), 212)
  near(convert(-40, 'C', 'F'), -40); near(convert(0, 'K', 'C'), -273.15)
  near(convert(273.15, 'K', 'F'), 32)
  assert.ok(Number.isNaN(convert(-1, 'K', 'C')))
})
test('running pace uses reciprocal speed and numeric minutes internally', () => {
  near(convert(5, 'pace_km', 'pace_mi'), 8.04672)
  near(convert(5, 'pace_km', 'kph'), 12)
  near(convert(6, 'mph', 'pace_mi'), 10)
  assert.ok(Number.isNaN(convert(0, 'kph', 'pace_km')))
  assert.ok(Number.isNaN(convert(0, 'pace_km', 'kph')))
  assert.ok(Number.isNaN(convert(0, 'pace_km', 'pace_mi')))
  assert.ok(Number.isNaN(convert(0, 'pace_mi', 'pace_mi')))
  assert.ok(Number.isNaN(convert(-1, 'pace_km', 'kph')))
  near(convert(0, 'kph', 'mph'), 0)
})
test('all compatible unit pairs round-trip', () => {
  for (const a of UNITS.filter((u) => u.id !== 'gas')) for (const b of UNITS.filter((u) => u.category === a.category && u.id !== 'gas')) {
    const value = a.category === 'temperature' ? 42 : 12.345
    near(convert(convert(value, a.id, b.id), b.id, a.id), value)
  }
  assert.ok(Number.isNaN(convert(1, 'kg', 'm')))
  assert.ok(Number.isNaN(convert(Infinity, 'm', 'ft')))
  assert.ok(Number.isNaN(convert(1, 'missing', 'm')))
})
test('all Islamic opinion values remain unchanged', () => {
  assert.deepEqual(Object.fromEntries(Object.entries(OPTIONS).map(([id, rows]) => [id, rows.map(([v]) => v)])), {
    poor_person: [.25, .5], gold: [85, 87.48], silver: [595, 612.36], sa: [2.5, 2.04, 2.1, 3, 3.25, 3.18], mil: [1.68, 1.85, 1.92], qasr: [80.64, 80, 81, 88.8, 77],
  })
})
test('Islamic defaults and derived relations', () => {
  near(convert(20, 'mithqal', 'ng'), 85); near(convert(200, 'dirham', 'sg'), 595)
  near(convert(7.5, 'tola', 'ng'), 87.48); near(convert(52.5, 'silver_tola', 'sg'), 612.36)
  near(convert(4, 'mudd', 'sa'), 1); near(convert(1, 'sa', 'fkg'), 2.5)
  near(convert(3500, 'dhira', 'mil'), 1); near(convert(3, 'mil', 'farsakh'), 1)
  near(convert(4, 'farsakh', 'barid'), 1); near(convert(4, 'barid', 'dkm'), 80.64)
})
for (const [id, rows] of Object.entries(OPTIONS)) test(`every ${id} opinion changes conversions and survives storage`, () => {
  const to = { gold: 'ng', silver: 'sg', sa: 'fkg', mil: 'dkm', qasr: 'dkm' }[id]
  for (const [v] of rows) {
    const s = parseState(JSON.stringify({ settings: { [id]: v } }))
    assert.equal(s.settings[id], v)
    if (id === 'poor_person') near(convert(1, 'fidya', 'fkg', s.settings), s.settings.sa * v)
    else near(convert(1, id, to, s.settings), v)
    if (id === 'sa') near(convert(4, 'mudd', 'fkg', s.settings), v)
    if (id === 'mil') near(convert(1, 'barid', 'dkm', s.settings), v * 12)
  }
})
test('language, Arabic digits, decimal separator and sensible rounding', () => {
  assert.equal(langOf(13), 'ar'); assert.equal(langOf('ar-SA'), 'ar'); assert.equal(langOf(2), 'en')
  assert.equal(format(1234.5), '1234.5'); assert.equal(digits('-0.25'), '-0.25')
  assert.equal(format(1234.5, true), '١٢٣٤٫٥'); assert.equal(digits('-0.25', true), '-٠٫٢٥')
  assert.equal(digits('جرام عيار 21'), 'جرام عيار 21')
  assert.equal(digits('جرام عيار 21', true), 'جرام عيار ٢١')
  assert.equal(digits('١٢٫٥'), '12.5')
  assert.equal(format(1 / 3), '0.333333'); assert.equal(format(-0), '0')
  assert.notEqual(format(.00000001), '0'); assert.equal(format(.00012), '0.00012')
  assert.equal(format(NaN), '—'); assert.equal(format(Infinity), '—')
  assert.equal(format(1e20, true), '١٠٠٠٠٠٠٠٠٠٠٠٠٠٠٠٠٠٠٠٠')
  assert.equal(format(.000001), '0.000001')
  assert.equal(format(1e-9), '0.000000001')
  assert.equal(format(1234567890123), '1234570000000')
  assert.equal(format(12.3400), '12.34')
  assert.equal(decimal(1e21), '1000000000000000000000')
  assert.equal(decimal(-1.25e-7), '-0.000000125')
  for (const v of [1e-30, 1e30, -1e-8, -1e25]) assert.ok(!/e/i.test(format(v)))
})
test('pace display rounds seconds with carry and input validates seconds', () => {
  assert.equal(format(convert(parsePace('5:00'), 'pace_km', 'pace_mi'), false, 'pace_mi'), '8:03')
  assert.equal(format(59.6 / 60, false, 'pace_km'), '1:00')
  assert.equal(format(5 + 59.6 / 60, false, 'pace_km'), '6:00')
  assert.equal(format(5 + 59.4 / 60, false, 'pace_km'), '5:59')
  assert.equal(format(5.5, true, 'pace_km'), '٥:٣٠')
  near(parsePace('5:30'), 5.5); near(parsePace('0:59'), 59 / 60)
  near(parsePace('5'), 5); near(parsePace('5:3'), 5.05)
  for (const v of ['5:60', '5:99', '5:', '5:000', '5.5', '-5:30', '5:3:2']) assert.ok(Number.isNaN(parsePace(v)), v)
  assert.equal(editNumber('5', ':', ':'), '5:')
  assert.equal(editNumber('5:30', ':', ':'), '5:30')
})
test('keypad editing: decimal, sign, backspace, length bound', () => {
  let v = '0'
  for (const k of ['7', '.', '5', '.', '2']) v = editNumber(v, k)
  assert.equal(v, '7.52'); assert.equal(editNumber(v, '+/-'), '-7.52')
  assert.equal(editNumber('-7.52', '+/-'), '7.52'); assert.equal(editNumber('1', '⌫'), '0')
  assert.equal(editNumber('123456789012', '3'), '123456789012'); assert.equal(editNumber('0', 'x'), '0')
})
test('stored data is validated without crashing or accepting unknown opinions', () => {
  for (const raw of ['', '{', 'null', '42', '[]']) assert.deepEqual(parseState(raw).settings, DEFAULTS)
  const s = parseState(JSON.stringify({ pair: { from: 'kg', to: 'm', value: 1 }, settings: { sa: -2 }, favourites: [null], recents: ['bad'] }))
  assert.equal(s.pair.from, 'm'); assert.equal(s.settings.sa, 2.5); assert.deepEqual(s.favourites, [])
})
test('digit preference defaults to Western, persists and rejects non-boolean settings', () => {
  assert.equal(parseState('').settings.arabic_digits, false)
  const s = parseState(JSON.stringify({ settings: { arabic_digits: true } }))
  assert.equal(parseState(JSON.stringify(s)).settings.arabic_digits, true)
  assert.equal(parseState(JSON.stringify({ settings: { arabic_digits: 'true' } })).settings.arabic_digits, false)
})
test('ingredient identity is preserved in favourites, recents and storage validation', () => {
  const s = parseState('')
  for (const ingredient of ['honey', 'flour']) {
    s.pair = { from: 'i_cup', to: 'i_g', value: 1, ingredient }
    pin(s); remember(s)
  }
  assert.equal(s.favourites.length, 2); assert.equal(s.recents.length, 2)
  const loaded = parseState(JSON.stringify(s))
  assert.deepEqual(loaded.favourites.map((p) => p.ingredient), ['honey', 'flour'])
  loaded.pair.ingredient = 'honey'; pin(loaded)
  assert.deepEqual(loaded.favourites.map((p) => p.ingredient), ['flour'])
  assert.equal(parseState(JSON.stringify({ pair: { from: 'i_cup', to: 'i_g', value: 1, ingredient: 'unknown' } })).pair.from, 'm')
})
test('recents deduplicate to ten newest pairs; favourites do not delete history', () => {
  const s = parseState('')
  const pairs = [['m', 'ft'], ['kg', 'lb'], ['C', 'F'], ['sa', 'fkg'], ['dinar', 'ng'], ['dirham', 'sg'], ['bar', 'psi'], ['kcal', 'kJ'], ['kmL', 'l100'], ['sqm', 'acre'], ['us_cup', 'ml'], ['pace_km', 'pace_mi']]
  pairs.forEach(([from, to], i) => { s.pair = { from, to, value: i + 1 }; remember(s) })
  assert.equal(s.recents.length, 10)
  assert.deepEqual(s.recents.map((p) => p.value), [12, 11, 10, 9, 8, 7, 6, 5, 4, 3])
  remember(s); assert.equal(s.recents.length, 10)
  pin(s); assert.equal(s.favourites.length, 1); pin(s); assert.equal(s.favourites.length, 0); assert.equal(s.recents.length, 10)
})
test('old three-entry histories survive and oversized saved histories are capped at ten', () => {
  const old = [{ from: 'm', to: 'ft', value: 1 }, { from: 'kg', to: 'lb', value: 2 }, { from: 'C', to: 'F', value: 3 }]
  assert.deepEqual(parseState(JSON.stringify({ recents: old })).recents, old)
  const oversized = Array.from({ length: 12 }, (_, i) => ({ from: 'm', to: 'ft', value: i + 1 }))
  assert.deepEqual(parseState(JSON.stringify({ recents: oversized })).recents, oversized.slice(0, 10))
})
