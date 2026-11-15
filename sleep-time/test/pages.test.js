// The real pages on stub @zos modules (tools/zos-stub.mjs): taps change what's shown, stored and set.
import { test, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { stub } from '../tools/zos-stub.mjs'

const T0 = 1_800_000_000
for (const p of ['index', 'settings', 'alarm', 'ring', 'remind']) await import(`../page/${p}.js`)
const [main, settings, alarm, ring, remind] = stub.pages
const shown = () => stub.widgets.filter((w) => w.visible)
const texts = () => shown().map((w) => w.o.text)
const tap = (label) => shown().find((w) => w.type === 'BUTTON' && w.o.text === label).o.click_func()
const open = (page, params) => {
  stub.widgets = []
  if (page.onInit) page.onInit(params)
  page.build()
}

beforeEach(() => Object.assign(stub, {
  store: { settings: JSON.stringify({ wake: 7 * 60 }) }, alarms: new Map(), alarmFails: false, timers: [],
  clock: { sec: T0, sod: 23 * 3600 + 30 * 60 }, systemMode: { DND: false, sleep: false }, pushed: null, exited: false, backed: false, launched: null, vibrating: null,
}))

test('main page: steppers, tabs and the settings button', () => {
  open(main)
  // wake at 07:00, 15 min to fall asleep: 6 cycles from 21:45, 1 cycle from 05:15
  assert.ok(['21:45', '9h', '05:15', '1h 30m'].every((t) => texts().includes(t)))
  tap('+') // hour + 1 → wake 08:00
  assert.ok(texts().includes('22:45'))
  assert.equal(JSON.parse(stub.store.settings).wake, 8 * 60)
  tap('Now') // 23:30 now
  assert.ok(texts().includes('01:15') && !texts().includes('+'))
  tap('Settings')
  assert.equal(stub.pushed.url, 'page/settings')
})

test('tapping a result asks to confirm; Set sets it and the banner shows it', () => {
  open(main)
  tap('Now')
  shown().filter((w) => w.type === 'IMG')[4].listeners.CLICK_UP() // 5 cycles: 23:30 + 15 + 450 = 07:15
  assert.deepEqual(JSON.parse(stub.pushed.params), { wake: 7 * 60 + 15, sleep: 450 })
  open(alarm, stub.pushed.params)
  assert.ok(['Alarm 07:15', '7h 30m of sleep', 'in 7h 45m'].every((t) => texts().includes(t)))
  tap('Set alarm')
  assert.ok(texts().includes('Alarm set'))
  assert.deepEqual([...stub.alarms.values()].map((a) => [a.url, a.time]), [['page/ring', T0 + 465 * 60]])
  open(main)
  assert.ok(texts().includes('07:15 · 7h 45m') && !texts().includes('Settings'))
  assert.deepEqual(shown().filter((w) => w.o.src || w.o.normal_src).map((w) => w.o.src || w.o.normal_src), ['icons/alarm.png', 'icons/gear.png'])
  shown().find((w) => w.type === 'IMG' && w.o.w === shown().find((c) => c.type === 'FILL_RECT' && c.o.color === 0x26235a && c.o.y > 400).o.w).listeners.CLICK_UP()
  assert.equal(stub.pushed.url, 'page/alarm')
  shown().find((w) => w.o.normal_src === 'icons/gear.png').o.click_func()
  assert.equal(stub.pushed.url, 'page/settings')
})

test('wake-up mode: the alarm at the wake time and a bedtime reminder', () => {
  stub.clock.sod = 20 * 3600
  open(main) // wake at 07:00; first result: 21:45 (6 cycles)
  shown().filter((w) => w.type === 'IMG')[0].listeners.CLICK_UP()
  open(alarm, stub.pushed.params)
  assert.ok(['Wake at 07:00', 'Bedtime reminder 21:45'].every((t) => texts().includes(t)))
  tap('Set alarm')
  assert.deepEqual([...stub.alarms.values()].map((a) => [a.url, a.time]), [['page/ring', T0 + 11 * 3600], ['page/remind', T0 + 105 * 60]])
})

test('a refused alarm offers the Alarm app', () => {
  stub.alarmFails = true
  open(alarm, JSON.stringify({ wake: 6 * 60, sleep: 450 }))
  tap('Set alarm')
  assert.ok(texts().includes("Couldn't set the alarm") && texts().includes('Set 06:00 in the Alarm app'))
  tap('Open Alarm app')
  assert.deepEqual(stub.launched, { appId: 'ALARM', native: true })
})

test('the banner opens the alarm, which can be cancelled', () => {
  open(alarm, JSON.stringify({ test: 1 }))
  assert.ok(texts().includes('Alarm set') && texts().includes('in 1m'))
  open(alarm)
  tap('Cancel alarm')
  assert.equal(stub.alarms.size, 0)
  assert.ok(stub.backed)
})

test('the test alarm leaves a real alarm alone', () => {
  open(alarm, JSON.stringify({ wake: 6 * 60, sleep: 450 }))
  tap('Set alarm')
  const before = [...stub.alarms.values()]
  open(alarm, JSON.stringify({ test: 1 }))
  assert.ok(texts().includes('Cancel it first to test'))
  assert.deepEqual([...stub.alarms.values()], before)
})

test('a refused snooze says so instead of closing', () => {
  open(alarm, JSON.stringify({ test: 1 }))
  open(ring)
  stub.alarmFails = true
  tap('Snooze 9 min')
  assert.ok(!stub.exited && texts().includes('Alarm stopped'))
})

test('ring page: vibrates; Stop ends it; Snooze sets another', () => {
  open(alarm, JSON.stringify({ test: 1 }))
  open(ring)
  assert.equal(stub.vibrating, 'TIMER')
  tap('Snooze 9 min')
  assert.equal(stub.vibrating, null)
  assert.deepEqual([...stub.alarms.values()].map((a) => a.time), [T0 + 540])
  open(ring)
  tap('Stop')
  assert.equal(stub.alarms.size, 0)
  assert.ok(stub.exited)
})

test('ring page: back (leaving it) snoozes; only Stop ends the alarm', () => {
  open(alarm, JSON.stringify({ test: 1 }))
  open(ring)
  ring.onDestroy()
  assert.equal(stub.vibrating, null)
  assert.deepEqual([...stub.alarms.values()].map((a) => [a.url, a.time]), [['page/ring', T0 + 540]])
  assert.equal(JSON.parse(stub.store.alarm).auto, 0) // a person did it: not an auto-snooze
})

test('confirm screen: Do Not Disturb on, off, or unknown', () => {
  const params = JSON.stringify({ wake: 6 * 60, sleep: 450 })
  stub.systemMode = { DND: true, sleep: false }
  open(alarm, params)
  assert.ok(texts().includes("Do Not Disturb is on: this alarm won't ring"))
  tap('Use watch alarm')
  assert.deepEqual(stub.launched, { appId: 'ALARM', native: true })
  assert.ok(texts().includes('Alarm 06:00')) // the time stays visible to enter there
  stub.systemMode = { DND: false, sleep: true }
  open(alarm, params)
  assert.ok(texts().includes("Sleep mode is on: this alarm won't ring"))
  stub.systemMode = { DND: false, sleep: false }
  open(alarm, params)
  assert.ok(!texts().includes('Use watch alarm'))
  stub.systemMode = undefined
  open(alarm, params)
  assert.ok(texts().includes('Silenced by Do Not Disturb') && texts().includes('Use watch alarm'))
})

test('ring page: unanswered, it stops after 2 minutes and snoozes, 3 times at most', () => {
  open(alarm, JSON.stringify({ test: 1 }))
  for (let i = 1; i <= 4; i++) {
    stub.timers = []
    open(ring)
    const t = stub.timers.find((x) => x.ms === 120000)
    t.fn()
    assert.equal(stub.vibrating, null)
    assert.equal(stub.alarms.size, i <= 3 ? 1 : 0, `round ${i}`)
    assert.ok(texts().includes(i <= 3 ? 'Snoozed until 23:39' : 'Alarm stopped'))
    ring.onDestroy() // the page exits; the snoozed alarm stays
    assert.equal(stub.alarms.size, i <= 3 ? 1 : 0)
  }
})

test('bedtime reminder: one notification buzz and the alarm time', () => {
  stub.clock.sod = 22 * 3600
  open(alarm, JSON.stringify({ wake: 6 * 60, remind: 22 * 60 + 30 }))
  tap('Set alarm')
  open(remind)
  assert.equal(stub.vibrating, 'NOTIFICATION')
  assert.ok(texts().includes('Time to sleep') && texts().includes('Alarm 06:00'))
})

test('settings page: − / + change and store a value; the test row sets an alarm a minute ahead', () => {
  open(settings)
  assert.ok(texts().includes('90 min') && texts().includes('9 min'))
  tap('+') // first row: cycle
  assert.ok(texts().includes('95 min'))
  assert.equal(JSON.parse(stub.store.settings).cycle, 95)
  tap('Test alarm in 1 minute')
  assert.deepEqual(stub.pushed, { url: 'page/alarm', params: JSON.stringify({ test: 1 }) })
})

test('Arabic chip: hour without a leading zero, kept right to left', async () => {
  const { STRINGS } = await import('../lib/i18n.js')
  const { formatTime, formatDuration } = await import('../lib/sleep.js')
  assert.equal(STRINGS.ar.chip(formatTime(6 * 60 + 25, true, 'ar'), formatDuration(465, 'ar')), '\u200F٦:٢٥ · \u200F٧ س ٤٥ د')
})
