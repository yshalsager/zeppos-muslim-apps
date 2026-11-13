// Prints face scenes as JSON for tools/gen-docs.py (README screenshots). Mirrors the text and
// colour logic of watchface/index.js refresh() for a fixed day in Cairo, default settings plus
// the "standard" iqama preset and an extra Fajr at 14.6°. Run: node tools/docs-data.mjs [lang]
// (lib/i18n code, default ar; Latin digits for the other languages, as the face defaults to).
import { dayEvents, nightPortions, PRAYER_ORDER } from '../lib/prayer.js'
import { hijriFromEpochDay, epochDay } from '../lib/hijri.js'
import { countdown } from '../lib/countdown.js'
import { CONFIG } from '../config.js'
import { layout } from '../lib/layout.js'
import {
  strings, hijriLine, gregLine, nextLine, extraItems, rangeLine, prayerName, line, MAKRUH_KEYS,
} from '../lib/i18n/text.js'

const lang = process.argv[2] || 'ar'
const T = strings(lang)
const [y, m, d, tz] = [2026, 11, 12, 2]
const IQAMA = [20, 15, 15, 10, 15] // "standard" preset: fajr, dhuhr, asr, maghrib, isha
const IQAMA_PRAYERS = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha']
const EXTRA_FAJR = 14.6
const AR = '٠١٢٣٤٥٦٧٨٩'
const digits = T.rtl ? (s) => String(s).replace(/\d/g, (c) => AR[c]) : (s) => String(s)
const pad = (n) => String(n).padStart(2, '0')
const clock = (v) => { const x = ((v % 1440) + 1440) % 1440; return `${Math.floor(x / 60) % 12 || 12}:${pad(x % 60)}` }
const time = (v) => digits(clock(v))

const opts = { lat: CONFIG.lat, lon: CONFIG.lon, tz, method: 'egypt', asrFactor: 1, adjust: CONFIG.adjust, sunriseWindowMin: CONFIG.sunriseWindowMin, extraFajrAngle: EXTRA_FAJR }
const ed = epochDay(y, m, d)
const ev = (dd) => dayEvents(y, m, dd, opts)
const t = ev(d), yd = ev(d - 1), tm = ev(d + 1)
const ctx = { yesterdayIsha: yd.isha - 1440, yesterdayMaghrib: yd.maghrib - 1440, tomorrowFajr: tm.fajr + 1440 }
const iqama = (k) => IQAMA[IQAMA_PRAYERS.indexOf(k)] || 0
const isFriday = false

const COLORS = { teal: 'teal', gold: 'gold', orange: 'orange', night: 'night' }
const hijri = hijriLine(T, hijriFromEpochDay(ed, 0), digits)
// with the fallback place, as the face shows it until a location is set
const greg = gregLine(T, { weekday: new Date(Date.UTC(y, m - 1, d)).getUTCDay(), d, m, y }, digits, T.fallbackPlace, layout().greg)

function prayersPage(nowMin) {
  const cd = countdown(t, nowMin, { ...ctx, iqama })
  const color = cd.iqama ? COLORS.gold : cd.urgent ? COLORS.orange : cd.lastThird ? COLORS.night : COLORS.teal
  const cells = PRAYER_ORDER.map((k) => ({ name: prayerName(T, k, isFriday), time: time(t[k]), on: k === cd.next }))
  return { time: time(nowMin), next: nextLine(T, cd, isFriday, digits), color, progress: cd.frac, cells }
}

function extrasPage(nowMin) {
  const night = nowMin < t.fajr ? nightPortions(ctx.yesterdayMaghrib, t.fajr) : nightPortions(t.maghrib, ctx.tomorrowFajr)
  const items = extraItems(T, night, t, null, { fajr: EXTRA_FAJR, isha: 0 }, digits)
  let upcoming = -1
  items.forEach(([, v], i) => { if (v > nowMin && (upcoming < 0 || v < items[upcoming][1])) upcoming = i })
  return { time: time(nowMin), title: line(T, T.pageNight), items: items.map(([name, v], i) => ({ name, time: time(v), on: i === upcoming })) }
}

function makruhPage(nowMin) {
  return {
    time: time(nowMin),
    title: line(T, T.pageMakruh),
    rows: MAKRUH_KEYS.map((k) => {
      const [a, b] = t.makruh[k]
      return { label: T.makruh[k], range: rangeLine(T, time(a), time(b)), on: nowMin >= a && nowMin < b }
    }),
  }
}

const at = (hh, mm) => hh * 60 + mm
console.log(JSON.stringify({
  rtl: T.rtl, hijri, greg,
  scenes: {
    prayers: prayersPage(at(10, 9)),
    urgent: prayersPage(t.dhuhr - 7),
    iqama: prayersPage(t.dhuhr + 8),
    lastThird: prayersPage(at(3, 30)),
    extras: extrasPage(at(22, 15)),
    makruh: makruhPage(t.dhuhr - 6),
    aod: prayersPage(at(10, 9)),
  },
}))
