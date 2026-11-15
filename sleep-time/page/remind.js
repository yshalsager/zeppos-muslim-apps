// Opened by the bedtime reminder timer: one notification buzz and a note, no ringing.
import { setStatusBarVisible } from '@zos/ui'
import { exit } from '@zos/router'
import { Vibrator, VIBRATOR_SCENE_NOTIFICATION } from '@zos/sensor'
import { setPageBrightTime } from '@zos/display'
import { T, L, timeText, durText, minutesUntil } from '../lib/env'
import { load } from '../lib/store'
import { now, upcoming, clockAt } from '../lib/alarms'
import { C, text, button } from '../lib/ui'

const A = L.alarm

Page({
  build() {
    setStatusBarVisible(false)
    try {
      setPageBrightTime({ brightTime: 30000 })
    } catch {
      // default screen time then
    }
    const s = load()
    const n = now()
    const up = upcoming(n)
    text(A.title, T.sleepNow, C.bestTime)
    if (up) {
      text(A.lines[0], T.alarm(timeText(clockAt(n, up.at), s)), C.white)
      text(A.lines[1], T.inTime(durText(minutesUntil(up.at, n))), C.dim)
    }
    button(A.button, T.ok, () => exit(), C.accent, C.white, C.accentDown)
    const v = new Vibrator()
    v.setMode(VIBRATOR_SCENE_NOTIFICATION)
    v.start()
  },
})
