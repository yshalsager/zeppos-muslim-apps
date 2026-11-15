import { test } from 'node:test'
import assert from 'node:assert/strict'
import { results, stepHour, stepMinute, formatTime, formatDuration, hourText, meridiem, parseSettings, DEFAULTS, step, is24 } from '../lib/sleep.js'

const hm = (h, m) => h * 60 + m
const times = (rs) => rs.map((r) => formatTime(r.time, true, 'en'))

test('wake up at midnight: bedtimes wrap back into the evening, earliest first', () => {
  const rs = results('wake', 0, 90, 15)
  assert.deepEqual(times(rs), ['14:45', '16:15', '17:45', '19:15', '20:45', '22:15'])
  assert.deepEqual(rs.map((r) => r.cycles), [6, 5, 4, 3, 2, 1])
  assert.equal(rs.at(-1).sleep, 90)
})

test('bed at midnight: wake times after it, first cycle first', () => {
  const rs = results('bed', 0, 90, 15)
  assert.deepEqual(times(rs), ['01:45', '03:15', '04:45', '06:15', '07:45', '09:15'])
  assert.deepEqual(rs.map((r) => r.sleep), [90, 180, 270, 360, 450, 540])
})

test('wrapping past midnight forwards, and "now" works like bed', () => {
  assert.deepEqual(times(results('bed', hm(23, 30), 90, 15)), ['01:15', '02:45', '04:15', '05:45', '07:15', '08:45'])
  assert.deepEqual(results('now', hm(23, 30), 90, 15), results('bed', hm(23, 30), 90, 15))
})

test('custom cycle and fall-asleep lengths', () => {
  assert.deepEqual(times(results('wake', hm(6, 0), 100, 0)), ['20:00', '21:40', '23:20', '01:00', '02:40', '04:20'])
  assert.deepEqual(times(results('bed', hm(22, 0), 60, 30)), ['23:30', '00:30', '01:30', '02:30', '03:30', '04:30'])
})

test('12- and 24-hour times, Latin and Arabic digits', () => {
  assert.equal(formatTime(0, true, 'en'), '00:00')
  assert.equal(formatTime(0, false, 'en'), '12:00 AM')
  assert.equal(formatTime(hm(12, 5), false, 'en'), '12:05 PM')
  assert.equal(formatTime(hm(22, 15), false, 'en'), '10:15 PM')
  assert.equal(formatTime(hm(22, 15), true, 'ar'), '٢٢:١٥')
  assert.equal(formatTime(hm(6, 25), true, 'ar'), '٦:٢٥') // Arabic: no leading zero in the hour
  assert.equal(formatTime(hm(0, 5), true, 'ar'), '٠:٠٥')
  assert.equal(formatTime(hm(6, 25), true, 'en'), '06:25')
  assert.equal(hourText(hm(6, 25), true, 'ar'), '٦')
  assert.equal(hourText(hm(18, 25), false, 'ar'), '٦')
  assert.equal(formatTime(hm(22, 15), false, 'ar'), '‏١٠:١٥ م')
  assert.equal(formatTime(hm(9, 0), false, 'ar'), '‏٩:٠٠ ص')
  assert.equal(hourText(hm(0, 30), false, 'en'), '12')
  assert.equal(hourText(hm(7, 30), true, 'en'), '07')
  assert.equal(meridiem(hm(12, 0), false, 'en'), 'PM')
  assert.equal(meridiem(hm(12, 0), true, 'en'), '')
})

test('durations', () => {
  assert.equal(formatDuration(450, 'en'), '7h 30m')
  assert.equal(formatDuration(540, 'en'), '9h')
  assert.equal(formatDuration(450, 'ar'), '‏٧ س ٣٠ د')
})

test('steppers wrap: hours around the day, minutes within the hour in 5s', () => {
  assert.equal(stepHour(hm(23, 30), 1), hm(0, 30))
  assert.equal(stepHour(hm(0, 30), -1), hm(23, 30))
  assert.equal(stepMinute(hm(7, 55), 1), hm(7, 0))
  assert.equal(stepMinute(hm(7, 0), -1), hm(7, 55))
  assert.equal(stepMinute(hm(7, 7), 1), hm(7, 10))
})

test('settings: defaults for missing, broken or out-of-range values; steps clamp or cycle', () => {
  assert.deepEqual(parseSettings(''), DEFAULTS)
  assert.deepEqual(parseSettings('not json'), DEFAULTS)
  assert.deepEqual(parseSettings('null'), DEFAULTS)
  const s = parseSettings(JSON.stringify({ cycle: 200, fall: 7, clock: '12', mode: 'now', wake: 365, bed: -5 }))
  assert.deepEqual(s, { ...DEFAULTS, clock: '12', mode: 'now', wake: 365 })
  assert.equal(step.cycle(120, 1), 120)
  assert.equal(step.fall(0, -1), 0)
  assert.equal(step.clock('auto', -1), '12')
  assert.equal(step.mode('now', 1), 'wake')
  assert.equal(is24('auto', false), false)
  assert.equal(is24('24', false), true)
})
