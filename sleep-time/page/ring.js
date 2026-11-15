// Opened by the alarm timer (lib/alarms.js): rings until Snooze or Stop. Leaving the page (back)
// snoozes: only Stop ends the alarm.
// Nobody reacts for 2 minutes: it stops and snoozes, at most AUTO_SNOOZES times, then gives up.
import { setStatusBarVisible, prop } from '@zos/ui'
import { exit } from '@zos/router'
import * as sensor from '@zos/sensor'
import * as display from '@zos/display'
import { T, L, timeText, num } from '../lib/env'
import { load } from '../lib/store'
import { now, snooze, clear, clockAt } from '../lib/alarms'
import { C, text, button } from '../lib/ui'

const R = L.ring
const RING_MS = 2 * 60 * 1000

Page({
  build() {
    setStatusBarVisible(false)
    this.done = false
    this.s = load()
    this.clock = new sensor.Time()
    const hm = () => this.clock.getHours() * 60 + this.clock.getMinutes()
    this.time = text(R.time, timeText(hm(), this.s), C.white)
    this.clock.onPerMinute(() => this.time.setProperty(prop.TEXT, timeText(hm(), this.s)))
    this.label = text(R.label, T.wakeUp, C.bestTime)
    button(R.snooze, T.snooze(num(this.s.snooze)), () => this.snooze(false), C.accent, C.white, C.accentDown)
    button(R.stop, T.stop, () => this.stop(), C.stop, C.white, C.stopDown)
    this.ring()
  },

  ring() {
    // keep the screen on while ringing (both reset when the page goes)
    try {
      display.setPageBrightTime({ brightTime: RING_MS + 10000 })
      if (typeof display.pauseDropWristScreenOff === 'function') display.pauseDropWristScreenOff({ duration: 0 })
    } catch {
      // the screen may go off; the vibration goes on
    }
    this.vibrator = new sensor.Vibrator()
    this.vibrator.setMode(sensor.VIBRATOR_SCENE_TIMER) // the watch's own alarm pattern, until stop()
    this.vibrator.start()
    // The alarm sound, where the watch has it (API 3.6) and its sounds are on
    try {
      if (typeof sensor.SystemSounds === 'function') {
        const sounds = new sensor.SystemSounds()
        if (sounds.getEnabled()) {
          sounds.start(sounds.getSourceType().ALARM, 0)
          this.sounds = sounds
        }
      }
    } catch {
      this.sounds = null
    }
    this.timeout = setTimeout(() => this.snooze(true), RING_MS)
  },

  quiet() {
    clearTimeout(this.timeout)
    if (this.vibrator) this.vibrator.stop()
    if (this.sounds) this.sounds.stop()
    this.vibrator = this.sounds = null
  },

  snooze(auto) {
    this.quiet()
    this.done = true
    const at = snooze(now(), this.s.snooze, auto)
    if (!auto && at) return exit()
    // say what happened (an auto-snooze, or a snooze the watch refused), then leave
    const n = now()
    this.label.setProperty(prop.TEXT, at ? T.snoozed(timeText(clockAt(n, at), this.s)) : T.stopped)
    setTimeout(() => exit(), 5000)
  },

  stop() {
    this.quiet()
    this.done = true
    clear()
    exit()
  },

  onDestroy() {
    this.quiet()
    if (!this.done) snooze(now(), this.s.snooze, false) // back gesture or button: same as Snooze
    if (this.clock && typeof this.clock.offPerMinute === 'function') this.clock.offPerMinute()
    try {
      if (typeof display.resetDropWristScreenOff === 'function') display.resetDropWristScreenOff()
    } catch {
      // nothing to reset
    }
  },
})
