// Prints sample face data as JSON for tools/gen-preview.py and tools/gen-edit-assets.py.
// Uses Zepp's standard preview time (10:09) on a fixed date in Cairo.
// Arabic: the store preview shows the face in its first language.
import { prayerMinutes, PRAYER_ORDER } from '../lib/prayer.js'
import { hijriFromEpochDay, epochDay } from '../lib/hijri.js'
import { CONFIG } from '../config.js'
import { countdown } from '../lib/countdown.js'
import { strings, hijriLine, gregLine, nextLine } from '../lib/i18n/text.js'

const [y, m, d, nowMin, tz] = [2026, 11, 12, 10 * 60 + 9, 2]
const AR = '٠١٢٣٤٥٦٧٨٩'
const ar = (s) => String(s).replace(/\d/g, (c) => AR[c])
const pad = (n) => String(n).padStart(2, '0')
const clock = (v) => `${Math.floor(v / 60) % 12 || 12}:${pad(v % 60)}`
const ed = epochDay(y, m, d)
const T = strings('ar')

const times = (method, asrFactor) =>
  prayerMinutes(y, m, d, { lat: CONFIG.lat, lon: CONFIG.lon, tz, method, asrFactor, adjust: CONFIG.adjust })
const nextOf = (t) => PRAYER_ORDER.find((k) => k !== 'sunrise' && t[k] > nowMin)
const cells = (t) => {
  const next = nextOf(t)
  return PRAYER_ORDER.map((k) => ({ name: T.prayers[k], time: ar(clock(t[k])), on: k === next }))
}

const t = times('egypt', 1)
const next = nextOf(t)
const left = t[next] - nowMin
const prev = (dd) => prayerMinutes(y, m, dd, { lat: CONFIG.lat, lon: CONFIG.lon, tz, method: 'egypt', asrFactor: 1, adjust: CONFIG.adjust })
const progress = countdown(t, nowMin, { yesterdayIsha: prev(d - 1).isha - 1440, yesterdayMaghrib: prev(d - 1).maghrib - 1440, tomorrowFajr: prev(d + 1).fajr + 1440 }).frac
console.log(JSON.stringify({
  // the face as it looks with default settings (preview icon)
  hijri: hijriLine(T, hijriFromEpochDay(ed, 0), ar),
  time: ar(clock(nowMin)),
  greg: gregLine(T, { weekday: new Date(Date.UTC(y, m - 1, d)).getUTCDay(), d, m, y }, ar),
  next: nextLine(T, { next, left }, false, ar),
  cells: cells(t),
  progress,
  // per-option previews for the edit screen
  edit: {
    clock: { arabic: ar(clock(nowMin)), latin: clock(nowMin) },
  },
}))
