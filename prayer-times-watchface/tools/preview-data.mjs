// Prints sample face data as JSON for tools/gen-preview.py and tools/gen-edit-assets.py.
// Uses Zepp's standard preview time (10:09) on a fixed date in Cairo.
import { prayerMinutes, PRAYER_ORDER, PRAYER_NAMES_AR } from '../lib/prayer.js'
import { hijriFromEpochDay, epochDay, HIJRI_MONTHS_AR, WEEKDAYS_AR } from '../lib/hijri.js'
import { CONFIG } from '../config.js'
import { countdown } from '../lib/countdown.js'

const [y, m, d, nowMin, tz] = [2026, 11, 12, 10 * 60 + 9, 2]
const AR = '٠١٢٣٤٥٦٧٨٩'
const ar = (s) => String(s).replace(/\d/g, (c) => AR[c])
const pad = (n) => String(n).padStart(2, '0')
const clock = (v) => `${Math.floor(v / 60) % 12 || 12}:${pad(v % 60)}`
const ed = epochDay(y, m, d)

const times = (method, asrFactor) =>
  prayerMinutes(y, m, d, { lat: CONFIG.lat, lon: CONFIG.lon, tz, method, asrFactor, adjust: CONFIG.adjust })
const nextOf = (t) => PRAYER_ORDER.find((k) => k !== 'sunrise' && t[k] > nowMin)
const cells = (t) => {
  const next = nextOf(t)
  return PRAYER_ORDER.map((k) => ({ name: PRAYER_NAMES_AR[k], time: ar(clock(t[k])), on: k === next }))
}
const hijri = (offset) => {
  const h = hijriFromEpochDay(ed, offset)
  return `${ar(h.day)} ${HIJRI_MONTHS_AR[h.month - 1]} ${ar(h.year)} هـ`
}

const t = times('egypt', 1)
const next = nextOf(t)
const left = t[next] - nowMin
const prev = (dd) => prayerMinutes(y, m, dd, { lat: CONFIG.lat, lon: CONFIG.lon, tz, method: 'egypt', asrFactor: 1, adjust: CONFIG.adjust })
const progress = countdown(t, nowMin, { yesterdayIsha: prev(d - 1).isha - 1440, yesterdayMaghrib: prev(d - 1).maghrib - 1440, tomorrowFajr: prev(d + 1).fajr + 1440 }).frac
console.log(JSON.stringify({
  // the face as it looks with default settings (preview icon)
  hijri: hijri(0),
  time: ar(clock(nowMin)),
  greg: `${WEEKDAYS_AR[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]}  ${ar(d)}/${ar(m)}/${ar(y)}`,
  next: `${PRAYER_NAMES_AR[next]} بعد ${ar(`${Math.floor(left / 60)}:${pad(left % 60)}`)}`,
  cells: cells(t),
  progress,
  // per-option previews for the edit screen
  edit: {
    clock: { arabic: ar(clock(nowMin)), latin: clock(nowMin) },
  },
}))
