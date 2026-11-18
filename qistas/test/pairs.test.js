import { test } from 'node:test'
import assert from 'node:assert/strict'
import { UNITS, convert } from '../lib/units.js'
import { parseState } from '../lib/state.js'
import { exact, quantities, ingredient_weights, gas_table } from './definitions.js'

const groups = Object.fromEntries(Object.entries(quantities).map(([name, ids]) => [name, ids.split(' ')]))
const reciprocal = new Set(['pace_km', 'pace_mi', 'l100'])
const near = (a, b, detail) => assert.ok(Number.isFinite(a) && Math.abs(a - b) <= Math.max(1e-11, Math.abs(b) * 1e-11), `${detail}: ${a} != ${b}`)

function cases(name) {
  if (name === 'gold_mass') return [85, 87.48].map((gold) => ({ settings: { gold } }))
  if (name === 'silver_mass') return [595, 612.36].map((silver) => ({ settings: { silver } }))
  if (name === 'ingredients') return Object.keys(ingredient_weights).map((ingredient) => ({ ingredient }))
  if (name === 'fitr') return [2.5, 2.04, 2.1, 3, 3.25, 3.18].flatMap((sa) => [.25, .5].map((poor_person) => ({ settings: { sa, poor_person } })))
  if (name === 'distance') return [1.68, 1.85, 1.92].flatMap((mil) => [80.64, 80, 81, 88.8, 77].map((qasr) => ({ settings: { mil, qasr } })))
  return [{}]
}
function reference_factors(context) {
  const { gold = 85, silver = 595, sa = 2.5, poor_person = .25, mil = 1.68, qasr = 80.64 } = context.settings || {}
  const cup = ingredient_weights[context.ingredient || 'flour']
  return { ...exact, gold, silver, sa, mudd: sa / 4, wasq: sa * 60, crops: sa * 300, fidya: sa * poor_person, oath: sa * poor_person * 10, fast: sa * poor_person * 60,
    mil: mil * 1000, farsakh: mil * 3000, barid: mil * 12000, qasr: qasr * 1000,
    i_cup: cup, i_metric: cup * 250 / 236.5882365, i_tbsp: cup / 16, i_tsp: cup / 48 }
}
function reference_temperature(value, from, to) {
  if (from === 'gas') {
    const row = gas_table.find(([mark]) => mark === value)
    if (!row) return NaN
    return to === 'gas' ? value : to === 'F' ? row[2] : to === 'K' ? row[1] + 273.15 : row[1]
  }
  const c = from === 'C' ? value : from === 'F' ? (value - 32) / 1.8 : value - 273.15
  if (to !== 'gas') return to === 'C' ? c : to === 'F' ? c * 1.8 + 32 : c + 273.15
  const column = from === 'F' ? 2 : 1
  const input = from === 'F' ? value : c
  if (input < gas_table[0][column] || input > gas_table[gas_table.length - 1][column]) return NaN
  return [...gas_table].sort((a, b) => Math.abs(a[column] - input) - Math.abs(b[column] - input) || b[0] - a[0])[0][0]
}

test('every unit has exactly one independently declared quantity/material context', () => {
  const ids = Object.values(groups).flat()
  assert.equal(new Set(ids).size, ids.length)
  assert.equal(new Set(UNITS.map((u) => u.id)).size, UNITS.length)
  assert.deepEqual(ids.sort(), UNITS.map((u) => u.id).sort())
  for (const [name, members] of Object.entries(groups)) for (const id of members) assert.equal(UNITS.find((u) => u.id === id).category, name, id)
})
for (const [name, ids] of Object.entries(groups)) {
  const scenarios = cases(name)
  test(`${name}: ${ids.length ** 2 * scenarios.length} ordered pair cases match independent values and round-trip`, () => {
    for (const context of scenarios) {
      const factors = reference_factors(context)
      for (const from of ids) for (const to of ids) {
        // Table anchors make the quantised gas pairs reversible; arbitrary temperatures are tested below.
        const value = name === 'temperature' ? { C: 180, F: 350, K: 453.15, gas: 4 }[from] : name === 'gold_mass' ? 100 : 1
        const base = reciprocal.has(from) ? factors[from] / value : factors[from] * value
        const expected = name === 'temperature' ? reference_temperature(value, from, to) : reciprocal.has(to) ? factors[to] / base : base / factors[to]
        const result = convert(value, from, to, context.settings, context.ingredient)
        const detail = `${name} ${from}->${to} ${JSON.stringify(context)}`
        near(result, expected, detail)
        near(convert(result, to, from, context.settings, context.ingredient), value, detail + ' reverse')
      }
    }
  })
}
test('separate converter groups never cross, including every reported gold/silver example', () => {
  const physical = Object.fromEntries(Object.entries(groups).flatMap(([name, ids]) => ids.map((id) => [id, name])))
  for (const a of UNITS) for (const b of UNITS) if (physical[a.id] !== physical[b.id]) assert.ok(Number.isNaN(convert(1, a.id, b.id)), `${a.id}->${b.id}`)
  for (const [value, from, to] of [[1, 'mahr', 'gold'], [1, 'mahr', 'gold_21'], [1, 'mahr', 'mithqal'], [1, 'gold', 'silver'], [100, 'gold_21', 'dirham']]) assert.ok(Number.isNaN(convert(value, from, to)), `${from}->${to}`)
  assert.ok(Number.isNaN(convert(1, 'ardeb', 'kg')))
})
test('legacy mixed-metal saved pairs are dropped while still-valid pairs survive', () => {
  const invalid = [{ from: 'mahr', to: 'gold', value: 1 }, { from: 'mahr', to: 'ng', value: 1 }, { from: 'gold_21', to: 'dirham', value: 100 }]
  const valid = [{ from: 'gold_21', to: 'gold_24', value: 100 }, { from: 'dirham', to: 'silver', value: 200 }]
  const s = parseState(JSON.stringify({ pair: invalid[0], favourites: [...invalid, ...valid], recents: [invalid[1], valid[0], valid[1]] }))
  assert.deepEqual(s.pair, { from: 'm', to: 'ft', value: 1 })
  assert.deepEqual(s.favourites, valid)
  assert.deepEqual(s.recents, valid)
})
test('all gas table entries round-trip through each temperature scale; off-table values snap or reject', () => {
  for (const [mark, c, f] of gas_table) for (const [scale, value] of [['C', c], ['F', f], ['K', c + 273.15]]) {
    near(convert(mark, 'gas', scale), value, `${mark}->${scale}`)
    near(convert(convert(mark, 'gas', scale), scale, 'gas'), mark, `${mark}->${scale}->gas`)
    near(convert(convert(value, scale, 'gas'), 'gas', scale), value, `${scale}->gas->${scale}`)
  }
  for (const [scale, value] of [['C', 125], ['C', 169], ['F', 340], ['K', 440]]) {
    const mark = reference_temperature(value, scale, 'gas')
    near(convert(value, scale, 'gas'), mark, 'nearest mark')
    near(convert(mark, 'gas', scale), reference_temperature(mark, 'gas', scale), 'quantised reverse')
  }
  for (const [scale, column, offset] of [['C', 1, 0], ['F', 2, 0], ['K', 1, 273.15]]) {
    for (let i = 1; i < gas_table.length; i++) {
      const midpoint = (gas_table[i - 1][column] + gas_table[i][column]) / 2 + offset
      assert.equal(convert(midpoint - 1e-6, scale, 'gas'), gas_table[i - 1][0])
      assert.equal(convert(midpoint, scale, 'gas'), gas_table[i][0])
      assert.equal(convert(midpoint + 1e-6, scale, 'gas'), gas_table[i][0])
    }
  }
  for (const mark of [-1, 0, .3, .75, 9.1, 10]) for (const to of groups.temperature) assert.ok(Number.isNaN(convert(mark, 'gas', to)))
  for (const [value, from] of [[109.99, 'C'], [240.01, 'C'], [224.99, 'F'], [475.01, 'F'], [383, 'K']]) assert.ok(Number.isNaN(convert(value, from, 'gas')))
})
test('absolute-zero boundaries reject every negative Kelvin and below-limit C/F value', () => {
  for (const [value, from] of [[-1e-9, 'K'], [-273.150000001, 'C'], [-459.670000001, 'F']]) for (const to of groups.temperature) assert.ok(Number.isNaN(convert(value, from, to)), `${value} ${from}->${to}`)
  for (const [value, from] of [[0, 'K'], [-273.15, 'C'], [-459.67, 'F']]) near(convert(value, from, 'K'), 0, 'absolute zero')
})
test('arithmetic overflow and underflow cannot produce a false zero', () => {
  for (const [from, to] of [['pace_km', 'pace_mi'], ['l100', 'l100'], ['mg', 'kg'], ['m', 'km']]) assert.ok(Number.isNaN(convert(Number.MIN_VALUE, from, to)), `${from}->${to}`)
  assert.equal(convert(Number.MIN_VALUE, 'ng', 'ng'), Number.MIN_VALUE)
  assert.equal(convert(0, 'mg', 'kg'), 0)
  for (const name of ['speed', 'fuel']) for (const from of groups[name]) for (const to of groups[name]) {
    assert.ok(Number.isNaN(convert(-1, from, to)), `${from}->${to} negative`)
    if (reciprocal.has(from) || reciprocal.has(to)) assert.ok(Number.isNaN(convert(0, from, to)), `${from}->${to} zero`)
    else assert.equal(convert(0, from, to), 0)
  }
})
