// The app's one alarm (and its bedtime reminder): @zos/alarm timers that reopen page/ring and
// page/remind, which ring by themselves. Their ids and times are kept in LocalStorage so a new alarm
// replaces the old one and the main page can show what's set.
import { set, cancel } from '@zos/alarm'
import { Time } from '@zos/sensor'
import { LocalStorage } from '@zos/storage'

const KEY = 'alarm'
const DAY = 86400
export const AUTO_SNOOZES = 3 // nobody reacts: snooze this many times, then stop
const storage = new LocalStorage()

// { sec: UTC seconds, sod: local seconds since midnight }
export function now() {
  const t = new Time()
  return { sec: Math.floor(t.getTime() / 1000), sod: t.getHours() * 3600 + t.getMinutes() * 60 + t.getSeconds() }
}

// The next time the clock shows min (minutes since midnight): later today, else tomorrow, as UTC seconds.
// shortcut: assumes no DST change before then (off by an hour on that one night); fine for a day ahead.
export const nextAt = (n, min) => {
  const at = n.sec - n.sod + min * 60
  return at > n.sec ? at : at + DAY
}
// What the clock will show at UTC second at, in minutes since midnight
export const clockAt = (n, at) => Math.floor((((n.sod + at - n.sec) % DAY) + DAY) % DAY / 60)

// { wake: { id, at } | null, remind: { id, at } | null, auto: auto-snoozes so far }
export function load() {
  try {
    const s = JSON.parse(storage.getItem(KEY, '') || '{}')
    const ok = (a) => (a && Number.isInteger(a.id) && Number.isInteger(a.at) ? a : null)
    return { wake: ok(s.wake), remind: ok(s.remind), auto: Number.isInteger(s.auto) ? s.auto : 0 }
  } catch {
    return { wake: null, remind: null, auto: 0 }
  }
}
const save = (s) => storage.setItem(KEY, JSON.stringify(s))

// A one-off timer that survives a reboot; its id, or 0 if the watch refused
function timer(url, at) {
  try {
    return set({ url, time: at, store: true }) || 0
  } catch {
    return 0
  }
}
function drop(a) {
  if (!a) return
  try {
    cancel(a.id)
  } catch {
    // already fired or gone
  }
}

export function clear() {
  const s = load()
  drop(s.wake)
  drop(s.remind)
  save({ wake: null, remind: null, auto: 0 })
}

// Replaces any alarm: wake at UTC second at, and a reminder at remindAt if it comes before it.
// false if the alarm couldn't be set; the old one then stays.
export function setAlarm(at, remindAt = null) {
  const old = load()
  const id = timer('page/ring', at)
  if (!id) return false
  drop(old.wake)
  drop(old.remind)
  let remind = null
  if (remindAt && remindAt < at) {
    const rid = timer('page/remind', remindAt)
    if (rid) remind = { id: rid, at: remindAt } // shortcut: a refused reminder is skipped silently; the alarm matters more
  }
  save({ wake: { id, at }, remind, auto: 0 })
  return true
}

// From the ring page: a new alarm minutes from now, keeping the auto-snooze count. auto snoozes stop
// after AUTO_SNOOZES; returns the new UTC second, or 0 when it stopped instead (or couldn't set).
export function snooze(n, minutes, auto) {
  const s = load()
  drop(s.wake)
  if (auto && s.auto >= AUTO_SNOOZES) {
    save({ wake: null, remind: null, auto: 0 })
    return 0
  }
  const at = n.sec + minutes * 60
  const id = timer('page/ring', at)
  save({ wake: id ? { id, at } : null, remind: null, auto: s.auto + (auto ? 1 : 0) })
  return id ? at : 0
}

// What the confirm screen says about Do Not Disturb, from getSystemMode() (@zos/settings, API 3.0):
// DND or Sleep mode known on → a warning (big: true); unreadable → a short note; known off → null.
// On the Bip Max an alarm doesn't ring with DND or Sleep mode on (both tested).
export function quietNotice(mode) {
  if (!mode || typeof mode.DND !== 'boolean') return { key: 'dndMaybe', big: false }
  if (mode.DND) return { key: 'dndOn', big: true }
  if (mode.sleep === true) return { key: 'sleepOn', big: true }
  return null
}

// The alarm still to come, or null; a passed one is forgotten
export function upcoming(n) {
  const s = load()
  if (!s.wake) return null
  if (s.wake.at <= n.sec) {
    save({ wake: null, remind: null, auto: 0 }) // its reminder (always earlier) has passed too
    return null
  }
  return { at: s.wake.at, remind: s.remind && s.remind.at > n.sec ? s.remind.at : null }
}
