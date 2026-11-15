// lib/alarms.js on the stub @zos/alarm, @zos/sensor and @zos/storage (tools/zos-stub.mjs)
import { test, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { stub } from '../tools/zos-stub.mjs'
const { nextAt, clockAt, setAlarm, snooze, clear, upcoming, load, now, quietNotice, AUTO_SNOOZES } = await import('../lib/alarms.js')

const T0 = 1_800_000_000 // some UTC second; the local clock is set separately
const at = (h, m, s = 0) => ({ sec: T0, sod: h * 3600 + m * 60 + s })
const hm = (h, m) => h * 60 + m

beforeEach(() => Object.assign(stub, { store: {}, alarms: new Map(), alarmFails: false, clock: at(23, 0) }))

test('next occurrence: later today, else tomorrow, across midnight', () => {
  assert.equal(nextAt(at(23, 0), hm(6, 30)), T0 + 7.5 * 3600) // after midnight: tomorrow morning
  assert.equal(nextAt(at(5, 0), hm(6, 30)), T0 + 1.5 * 3600) // same day
  assert.equal(nextAt(at(6, 30, 20), hm(6, 30)), T0 + 86400 - 20) // just passed: tomorrow
  assert.equal(nextAt(at(6, 29, 59), hm(6, 30)), T0 + 1) // a second away: today
  assert.equal(nextAt(at(0, 0), hm(0, 0)), T0 + 86400) // now exactly: tomorrow
  assert.equal(nextAt(at(23, 59), hm(0, 0)), T0 + 60)
  assert.equal(clockAt(at(23, 0), T0 + 7.5 * 3600), hm(6, 30))
  assert.equal(clockAt(at(23, 59), T0 + 60), 0)
})

test('now() reads the watch clock', () => {
  stub.clock = at(22, 15, 30)
  assert.deepEqual(now(), { sec: T0, sod: 22 * 3600 + 15 * 60 + 30 })
})

test('an alarm and its reminder; a new one replaces both', () => {
  const n = at(21, 0)
  assert.ok(setAlarm(nextAt(n, hm(6, 30)), nextAt(n, hm(22, 45))))
  assert.deepEqual([...stub.alarms.values()].map((a) => [a.url, a.time, a.store]), [['page/ring', T0 + 9.5 * 3600, true], ['page/remind', T0 + 1.75 * 3600, true]])
  assert.ok(setAlarm(nextAt(n, hm(7, 0))))
  assert.deepEqual([...stub.alarms.values()].map((a) => a.url), ['page/ring'])
  assert.equal(load().wake.at, T0 + 10 * 3600)
  assert.equal(load().remind, null)
})

test('a reminder that would come after the alarm is skipped', () => {
  const n = at(23, 0) // bedtime 22:45 already passed: its next one is tomorrow night, after waking
  assert.ok(setAlarm(nextAt(n, hm(6, 30)), nextAt(n, hm(22, 45))))
  assert.deepEqual([...stub.alarms.values()].map((a) => a.url), ['page/ring'])
})

test('a refused alarm keeps the old one and reports it', () => {
  assert.ok(setAlarm(T0 + 3600))
  stub.alarmFails = true
  assert.equal(setAlarm(T0 + 7200), false)
  assert.equal(stub.alarms.size, 1)
  assert.equal(load().wake.at, T0 + 3600)
})

test('cancel removes the timers and the banner', () => {
  setAlarm(T0 + 3600, T0 + 600)
  clear()
  assert.equal(stub.alarms.size, 0)
  assert.equal(upcoming(at(0, 0)), null)
})

test('upcoming: shown until it rings, then forgotten', () => {
  setAlarm(T0 + 3600, T0 + 600)
  assert.deepEqual(upcoming({ sec: T0, sod: 0 }), { at: T0 + 3600, remind: T0 + 600 })
  assert.deepEqual(upcoming({ sec: T0 + 900, sod: 0 }), { at: T0 + 3600, remind: null })
  assert.equal(upcoming({ sec: T0 + 3600, sod: 0 }), null)
  assert.equal(load().wake, null)
})

test('snooze: a new one-off alarm; auto-snoozes stop after the limit', () => {
  setAlarm(T0)
  const n = { sec: T0 + 5, sod: 0 }
  assert.equal(snooze(n, 9, false), T0 + 5 + 540)
  assert.equal(stub.alarms.size, 1)
  for (let i = 1; i <= AUTO_SNOOZES; i++) {
    assert.equal(snooze(n, 9, true), T0 + 5 + 540, `auto ${i}`)
    assert.equal(load().auto, i)
  }
  assert.equal(snooze(n, 9, true), 0) // gave up
  assert.equal(stub.alarms.size, 0)
  assert.equal(load().wake, null)
  // a new alarm starts counting again
  setAlarm(T0 + 100)
  assert.equal(load().auto, 0)
})

test('Do Not Disturb notice: warn when known on, note when unknown, nothing when off', () => {
  assert.deepEqual(quietNotice({ DND: true, sleep: false }), { key: 'dndOn', big: true })
  assert.deepEqual(quietNotice({ DND: false, sleep: true }), { key: 'sleepOn', big: true })
  assert.equal(quietNotice({ DND: false, sleep: false }), null)
  assert.deepEqual(quietNotice(undefined), { key: 'dndMaybe', big: false })
  assert.deepEqual(quietNotice({}), { key: 'dndMaybe', big: false })
})
