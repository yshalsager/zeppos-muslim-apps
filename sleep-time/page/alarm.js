// Confirm an alarm (params from a tapped result), set a test one (params { test: 1 }), or, with no
// params, show the alarm that's set and cancel it. If the watch refuses the timer, offer the
// system Alarm app with the time to enter by hand.
import { deleteWidget, setStatusBarVisible } from '@zos/ui'
import { back, launchApp, SYSTEM_APP_ALARM } from '@zos/router'
import * as settings from '@zos/settings'
import { T, L, timeText, durText, minutesUntil } from '../lib/env'
import { load } from '../lib/store'
import { now, nextAt, clockAt, setAlarm, clear, upcoming, quietNotice } from '../lib/alarms'
import { C, text, button } from '../lib/ui'

const A = L.alarm

// the watch's own Alarm app; the time stays on screen to enter there
function watchAlarm() {
  try {
    launchApp({ appId: SYSTEM_APP_ALARM, native: true })
  } catch {
    // no system Alarm app to open
  }
}

// getSystemMode()'s { DND, sleep, … }, or undefined where the watch doesn't have it
function systemMode() {
  try {
    return typeof settings.getSystemMode === 'function' ? settings.getSystemMode() : undefined
  } catch {
    return undefined
  }
}

Page({
  onInit(params) {
    try {
      this.p = JSON.parse(params || '{}') || {}
    } catch {
      this.p = {}
    }
  },

  build() {
    setStatusBarVisible(false)
    this.s = load()
    const p = this.p || {}
    if (p.test) this.test()
    else if (Number.isInteger(p.wake)) this.confirm(p)
    else this.current()
  },

  // title, up to 3 lines, one button; replaces what was shown
  view(title, lines, label, fn, color = C.accent, down = C.accentDown) {
    for (const w of this.widgets || []) deleteWidget(w)
    this.widgets = [text(A.title, title, C.white), ...lines.map((s, i) => text(A.lines[i], s || '', i ? C.dim : C.white))]
    this.widgets.push(button(A.button, label, fn, color, C.white, down))
  },

  confirm(p) {
    const n = now()
    const t = (m) => timeText(m, this.s)
    const at = nextAt(n, p.wake)
    const lines = Number.isInteger(p.remind) ? [T.reminder(t(p.remind))] : [T.sleepFor(durText(p.sleep))]
    lines.push(T.inTime(durText(minutesUntil(at, n))))
    this.view(Number.isInteger(p.remind) ? T.wakeAt(t(p.wake)) : T.alarm(t(p.wake)), lines, T.set, () => {
      const n2 = now()
      this.set(nextAt(n2, p.wake), Number.isInteger(p.remind) ? nextAt(n2, p.remind) : null, false)
    })
    // An alarm doesn't ring with Do Not Disturb on: warn, and offer the watch's own alarm
    const q = quietNotice(systemMode())
    if (q) {
      this.widgets.push(text(A.warn, T[q.key], q.big ? C.warn : C.dim, true))
      this.widgets.push(button(q.big ? A.alt : A.altSmall, T.useWatch, watchAlarm))
    }
  },

  // A test would replace (and Stop would clear) the real alarm: only without one
  test() {
    const n = now()
    const up = upcoming(n)
    if (up) return this.view(T.alarm(timeText(clockAt(n, up.at), this.s)), [T.cancelFirst], T.ok, () => back(), C.key, C.keyDown)
    this.set(n.sec + 60, null, true)
  },

  set(at, remindAt, test) {
    const n = now()
    const t = timeText(clockAt(n, at), this.s)
    if (!setAlarm(at, remindAt)) {
      this.view(T.failed, [T.byHand(t)], T.openAlarms, watchAlarm, C.key, C.keyDown)
      return
    }
    const up = upcoming(n)
    const extra = test ? T.testDone : up && up.remind ? T.reminder(timeText(clockAt(n, up.remind), this.s)) : ''
    this.view(T.setDone, [T.alarm(t), T.inTime(durText(minutesUntil(at, n))), extra], T.ok, () => back())
  },

  current() {
    const n = now()
    const up = upcoming(n)
    if (!up) return this.view(T.none, [], T.ok, () => back(), C.key, C.keyDown)
    const t = (at) => timeText(clockAt(n, at), this.s)
    this.view(T.alarm(t(up.at)), [T.inTime(durText(minutesUntil(up.at, n))), up.remind ? T.reminder(t(up.remind)) : ''], T.cancel, () => {
      clear()
      back()
    }, C.stop, C.stopDown)
  },
})
