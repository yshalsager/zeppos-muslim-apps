// Prints face scenes as JSON for tools/gen-docs.py (README screenshots). Mirrors the text and
// colour logic of watchface/index.js refresh() for a fixed day in Cairo, default settings plus
// the "standard" iqama preset and an extra Fajr at 14.6°.
import { dayEvents, nightPortions, PRAYER_ORDER, PRAYER_NAMES_AR } from '../lib/prayer.js'
import { hijriFromEpochDay, epochDay, HIJRI_MONTHS_AR, WEEKDAYS_AR } from '../lib/hijri.js'
import { countdown } from '../lib/countdown.js'
import { CONFIG } from '../config.js'

const [y, m, d, tz] = [2026, 11, 12, 2]
const IQAMA = [20, 15, 15, 10, 15] // "standard" preset: fajr, dhuhr, asr, maghrib, isha
const IQAMA_PRAYERS = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha']
const EXTRA_FAJR = 14.6
const AR = '٠١٢٣٤٥٦٧٨٩'
const ar = (s) => String(s).replace(/\d/g, (c) => AR[c])
const pad = (n) => String(n).padStart(2, '0')
const clock = (v) => { const x = ((v % 1440) + 1440) % 1440; return `${Math.floor(x / 60) % 12 || 12}:${pad(x % 60)}` }
const RLM = '‏'
const rtl = (s) => (/^[ء-يٱ-ۓ]/.test(s) ? s : RLM + s)

const opts = { lat: CONFIG.lat, lon: CONFIG.lon, tz, method: 'egypt', asrFactor: 1, adjust: CONFIG.adjust, sunriseWindowMin: CONFIG.sunriseWindowMin, extraFajrAngle: EXTRA_FAJR }
const ed = epochDay(y, m, d)
const ev = (dd) => dayEvents(y, m, dd, opts)
const t = ev(d), yd = ev(d - 1), tm = ev(d + 1)
const ctx = { yesterdayIsha: yd.isha - 1440, yesterdayMaghrib: yd.maghrib - 1440, tomorrowFajr: tm.fajr + 1440 }
const iqama = (k) => IQAMA[IQAMA_PRAYERS.indexOf(k)] || 0

const COLORS = { teal: 'teal', gold: 'gold', orange: 'orange', night: 'night' }
const h = hijriFromEpochDay(ed, 0)
const hijri = rtl(`${ar(h.day)} ${HIJRI_MONTHS_AR[h.month - 1]} ${ar(h.year)} هـ`)
const greg = rtl(`${WEEKDAYS_AR[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]}  ${ar(d)}/${ar(m)}/${ar(y)}`)

function prayersPage(nowMin) {
  const cd = countdown(t, nowMin, { ...ctx, iqama })
  const fmtLeft = (left) => (left >= 60 ? `${Math.floor(left / 60)}:${pad(left % 60)}` : `${left} د`)
  const left = ar(fmtLeft(cd.left))
  let next = rtl(cd.iqama ? `إقامة ${PRAYER_NAMES_AR[cd.next]} بعد ${left}` : `${PRAYER_NAMES_AR[cd.next]} بعد ${left}`)
  if (cd.lastThird && !cd.urgent) next = `الثلث الأخير  •  ${next}`
  const color = cd.iqama ? COLORS.gold : cd.urgent ? COLORS.orange : cd.lastThird ? COLORS.night : COLORS.teal
  const cells = PRAYER_ORDER.map((k) => ({ name: PRAYER_NAMES_AR[k], time: ar(clock(t[k])), on: k === cd.next }))
  return { time: ar(clock(nowMin)), next, color, progress: cd.frac, cells }
}

function extrasPage(nowMin) {
  const night = nowMin < t.fajr ? nightPortions(ctx.yesterdayMaghrib, t.fajr) : nightPortions(t.maghrib, ctx.tomorrowFajr)
  const items = [['الثلث الأول', night.firstThird], ['منتصف الليل', night.midpoint], ['الثلث الأخير', night.lastThird],
    ['السدس الأخير', night.lastSixth], ['الضحى', t.duha]]
  if (!isNaN(t.extraFajr)) items.push([`الفجر (${ar(EXTRA_FAJR)}°)`, t.extraFajr])
  let upcoming = -1
  items.forEach(([, v], i) => { if (v > nowMin && (upcoming < 0 || v < items[upcoming][1])) upcoming = i })
  return { time: ar(clock(nowMin)), items: items.map(([name, v], i) => ({ name, time: ar(clock(v)), on: i === upcoming })) }
}

function makruhPage(nowMin) {
  const rows = [['dawn', 'من الفجر'], ['sunrise', 'الشروق'], ['zawal', 'الاستواء'], ['afterAsr', 'بعد العصر'], ['sunset', 'الغروب']]
  return {
    time: ar(clock(nowMin)),
    rows: rows.map(([k, label]) => {
      const [a, b] = t.makruh[k]
      return { label, range: rtl(`${ar(clock(a))} - ${ar(clock(b))}`), on: nowMin >= a && nowMin < b }
    }),
  }
}

const at = (hh, mm) => hh * 60 + mm
console.log(JSON.stringify({
  hijri, greg,
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
