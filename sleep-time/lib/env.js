// What the pages read from the watch once: screen, language, clock format; and their text helpers.
import { getDeviceInfo } from '@zos/device'
import { getLanguage, getTimeFormat, TIME_FORMAT_24 } from '@zos/settings'
import { langOf, STRINGS } from './i18n'
import { layout } from './layout'
import { formatTime, formatDuration, digits, is24 } from './sleep'

const { width, height } = getDeviceInfo()
export const lang = langOf(getLanguage())
export const T = STRINGS[lang]
export const L = layout(width, height, lang === 'ar')
export const watch24 = getTimeFormat() === TIME_FORMAT_24

// minutes since midnight → '06:15' in the clock the settings ask for
export const timeText = (min, s) => formatTime(min, is24(s.clock, watch24), lang)
// minutes → '7h 12m'
export const durText = (m) => formatDuration(m, lang)
export const num = (s) => digits(s, lang)
// UTC seconds from now → minutes, rounded up (an alarm 30 s away is "in 1m")
export const minutesUntil = (at, n) => Math.max(Math.ceil((at - n.sec) / 60), 0)
