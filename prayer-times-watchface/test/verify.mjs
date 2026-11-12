// Checks lib/ against independent references. Run: pnpm test  (try also TZ=Pacific/Auckland pnpm test)
import { Coordinates, CalculationMethod, Madhab, PrayerTimes } from 'adhan'
import { prayerMinutes, dayEvents, nightPortions, METHODS, PRAYER_ORDER } from '../lib/prayer.js'
import { hijriFromEpochDay, epochDay } from '../lib/hijri.js'
import { countdown, URGENT_MIN } from '../lib/countdown.js'

let fail = 0
const check = (ok, ...msg) => { if (!ok && fail++ < 10) console.log('FAIL', ...msg) }

// 1) Hijri vs ICU umalqura, every day 2018-09-11 .. 2077-11-15
const fmt = new Intl.DateTimeFormat('en-u-ca-islamic-umalqura', { timeZone: 'UTC', day: 'numeric', month: 'numeric', year: 'numeric' })
let n = 0
for (let ed = epochDay(2018, 9, 11); ed < epochDay(2077, 11, 15); ed++, n++) {
  const p = {}; for (const x of fmt.formatToParts(new Date(ed * 864e5))) p[x.type] = Number(x.value)
  const h = hijriFromEpochDay(ed)
  check(h.year === p.year && h.month === p.month && h.day === p.day, 'hijri', ed, h, p)
}
console.log(`hijri: ${n} days match ICU umalqura`)

// 2) Wrapper vs adhan formatted by ICU in Africa/Cairo (covers Egypt's DST switches).
const ZONE = 'Africa/Cairo'
const hm = new Intl.DateTimeFormat('en-GB', { timeZone: ZONE, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
const ymd = new Intl.DateTimeFormat('en-CA', { timeZone: ZONE, year: 'numeric', month: '2-digit', day: '2-digit' })
const tzHours = (y, m, d) => { // UTC offset of ZONE at local noon
  const t = Date.UTC(y, m - 1, d, 10)
  const [hh, mm] = hm.format(new Date(t)).split(':').map(Number)
  return Math.round(((hh * 60 + mm) - 600) / 15) / 4
}
const cities = [['Cairo', 30.0444, 31.2357], ['Alexandria', 31.2001, 29.9187], ['Aswan', 24.0889, 32.8998]]
const methods = { egypt: 'Egyptian', mwl: 'MuslimWorldLeague', karachi: 'Karachi', isna: 'NorthAmerica', makkah: 'UmmAlQura' }
let cmp = 0
for (const [name, lat, lon] of cities) {
  for (const [key, adhanName] of Object.entries(methods)) {
    for (const asrFactor of [1, 2]) {
      for (let doy = 0; doy < 366; doy += 3) {
        const dt = new Date(Date.UTC(2026, 0, 1 + doy))
        const [y, m, d] = [dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate()]
        const mine = prayerMinutes(y, m, d, { lat, lon, tz: tzHours(y, m, d), method: key, asrFactor })
        const params = CalculationMethod[adhanName]()
        params.madhab = asrFactor === 2 ? Madhab.Hanafi : Madhab.Shafi
        const ref = new PrayerTimes(new Coordinates(lat, lon), new Date(y, m - 1, d, 12), params)
        for (const k of PRAYER_ORDER) {
          const day = ymd.format(ref[k]) === `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}` ? 0 : 1440
          const [hh, mm] = hm.format(ref[k]).split(':').map(Number)
          check(mine[k] === hh * 60 + mm + day, name, key, asrFactor, y, m, d, k, mine[k], hh * 60 + mm + day)
          cmp++
        }
      }
    }
  }
}
console.log(`prayer: ${cmp} times match adhan in ${ZONE} (host TZ=${Intl.DateTimeFormat().resolvedOptions().timeZone})`)

// 3) Per-prayer adjust is applied on top of the method's own adjustment.
const base = prayerMinutes(2026, 11, 12, { lat: 30.0444, lon: 31.2357, tz: 2, method: 'egypt', asrFactor: 1 })
const adj = prayerMinutes(2026, 11, 12, { lat: 30.0444, lon: 31.2357, tz: 2, method: 'egypt', asrFactor: 1, adjust: { fajr: 2, isha: -1 } })
check(adj.fajr === base.fajr + 2 && adj.isha === base.isha - 1 && adj.dhuhr === base.dhuhr, 'adjust', base, adj)

// 4) Angle-based events vs an independent solar-altitude formula (NOAA, geometric altitude).
const sunAltitude = (utcMs, lat, lon) => {
  const jd = utcMs / 864e5 + 2440587.5, T = (jd - 2451545) / 36525, rad = Math.PI / 180
  const L0 = (280.46646 + T * (36000.76983 + 0.0003032 * T)) % 360, M = 357.52911 + T * (35999.05029 - 0.0001537 * T)
  const C = Math.sin(M * rad) * (1.914602 - T * (0.004817 + 0.000014 * T)) + Math.sin(2 * M * rad) * (0.019993 - 0.000101 * T) + Math.sin(3 * M * rad) * 0.000289
  const lam = L0 + C - 0.00569 - 0.00478 * Math.sin((125.04 - 1934.136 * T) * rad)
  const eps = 23 + (26 + (21.448 - T * (46.815 + T * (0.00059 - T * 0.001813))) / 60) / 60 + 0.00256 * Math.cos((125.04 - 1934.136 * T) * rad)
  const decl = Math.asin(Math.sin(eps * rad) * Math.sin(lam * rad))
  const ra = Math.atan2(Math.cos(eps * rad) * Math.sin(lam * rad), Math.cos(lam * rad)) / rad
  const gmst = (280.46061837 + 360.98564736629 * (jd - 2451545)) % 360
  const H = (gmst + lon - ra) * rad
  return Math.asin(Math.sin(lat * rad) * Math.sin(decl) + Math.cos(lat * rad) * Math.cos(decl) * Math.cos(H)) / rad
}
let angleChecks = 0
for (const [name, lat, lon] of cities) {
  for (let doy = 0; doy < 366; doy += 5) {
    const dt = new Date(Date.UTC(2026, 0, 1 + doy))
    const [y, m, d] = [dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate()]
    for (const asrFactor of [1, 2]) {
      const e = dayEvents(y, m, d, { lat, lon, tz: 0, method: 'egypt', asrFactor, extraFajrAngle: 18, extraIshaAngle: 16 })
      const at = (min) => sunAltitude(Date.UTC(y, m - 1, d) + min * 60000, lat, lon)
      // minute rounding moves the sun by up to ~0.15° at these latitudes
      check(Math.abs(at(e.extraFajr) + 18) < 0.3, 'extraFajr altitude', name, y, m, d, at(e.extraFajr))
      check(Math.abs(at(e.extraIsha) + 16) < 0.3, 'extraIsha altitude', name, y, m, d, at(e.extraIsha))
      check(Math.abs(at(e.makruh.sunset[0]) - 5) < 0.3, 'makruh +5° altitude', name, y, m, d, at(e.makruh.sunset[0]))
      // window shapes from the add-on's definitions
      const z = asrFactor === 2 ? 5 : 10
      check(e.makruh.zawal[1] - e.makruh.zawal[0] === z && e.makruh.zawal[1] === e.noon, 'zawal', name, y, m, d)
      check(e.duha === e.makruh.sunrise[1] && e.duha === e.makruh.sunrise[0] + 15, 'duha', name, y, m, d)
      check(e.makruh.afterAsr[0] === e.asr && e.makruh.afterAsr[1] === e.makruh.sunset[0], 'afterAsr', name, y, m, d)
      check(e.eidStart === e.makruh.sunrise[0] + 15 && e.eidEnd === e.noon, 'eid window', name, y, m, d)
      angleChecks += 3
    }
  }
}
// Extras equal to the method's own angle are suppressed (UIOF is 12°/12°; Umm al-Qura Isha is interval-based).
{
  const base = { lat: 30.0444, lon: 31.2357, tz: 2, asrFactor: 1 }
  const u = dayEvents(2026, 11, 12, { ...base, method: 'uiof', extraFajrAngle: 12, extraIshaAngle: 12 })
  check(isNaN(u.extraFajr) && isNaN(u.extraIsha), 'uiof 12° extras suppressed', u.extraFajr, u.extraIsha)
  const q = dayEvents(2026, 11, 12, { ...base, method: 'makkah', extraFajrAngle: 14.6, extraIshaAngle: 12 })
  check(!isNaN(q.extraFajr) && !isNaN(q.extraIsha) && q.extraFajr > q.fajr, 'umm al-qura extras shown', q.extraFajr, q.extraIsha)
  const e = dayEvents(2026, 11, 12, { ...base, method: 'egypt', extraFajrAngle: 19.5 })
  check(isNaN(e.extraFajr), 'egypt 19.5° extra suppressed')
}
const np = nightPortions(17 * 60 + 1, 24 * 60 + 4 * 60 + 49)
check(np.firstThird === 20 * 60 + 57 && np.midpoint === 22 * 60 + 55 && np.lastThird === 24 * 60 + 53 && np.lastSixth === 26 * 60 + 51, 'night portions', np)
for (const k of Object.keys(METHODS)) {
  const t = prayerMinutes(2026, 11, 12, { lat: 30.0444, lon: 31.2357, tz: 2, method: k, asrFactor: 1 })
  check(PRAYER_ORDER.every((p, i) => !isNaN(t[p]) && (i === 0 || t[p] > t[PRAYER_ORDER[i - 1]])), 'method order', k, t)
}
console.log(`events: ${angleChecks} sun-altitude checks within 0.3°, windows match add-on definitions, ${Object.keys(METHODS).length} methods ordered`)

const f = (v) => `${Math.floor(v / 60)}:${String(v % 60).padStart(2, '0')}`
console.log('Cairo 2026-11-12:', PRAYER_ORDER.map((k) => `${k} ${f(base[k])}`).join(', '))
// 6) Countdown line: every minute of a Cairo day, with and without iqama.
{
  const ev = (y, m, d) => dayEvents(y, m, d, { lat: 30.0444, lon: 31.2357, tz: 2, method: 'egypt' })
  const t = ev(2026, 11, 12), yd = ev(2026, 11, 11), tm = ev(2026, 11, 13)
  const base = { yesterdayIsha: yd.isha - 1440, yesterdayMaghrib: yd.maghrib - 1440, tomorrowFajr: tm.fajr + 1440 }
  const order = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha']
  const IQ = { fajr: 20, dhuhr: 15, asr: 15, maghrib: 10, isha: 15 }
  const night = nightPortions(yd.maghrib - 1440, t.fajr), tonight = nightPortions(t.maghrib, tm.fajr + 1440)
  let mins = 0
  for (const iq of [null, (k) => IQ[k]]) {
    let prevFrac = -1, prevPhase = null
    for (let now = 0; now < 1440; now++, mins++) {
      const c = countdown(t, now, { ...base, iqama: iq })
      const at = c.iqama ? t[c.next] + IQ[c.next] : c.next === 'fajr' && now >= t.fajr ? tm.fajr + 1440 : t[c.next]
      check(c.left === at - now && c.left > 0, 'countdown left', now, c)
      check(c.frac >= 0 && c.frac <= 1 && (`${c.next}${c.iqama}` !== prevPhase || c.frac >= prevFrac), 'countdown frac', now, c)
      check(c.urgent === (!c.iqama && c.left <= URGENT_MIN), 'countdown urgent', now, c)
      const inIqama = !!iq && order.some((k) => now >= t[k] && now < t[k] + IQ[k])
      check(c.iqama === inIqama, 'countdown iqama', now, c)
      const last = c.next === 'fajr' && !c.iqama && (now < t.fajr ? now >= night.lastThird : now >= tonight.lastThird)
      check(c.lastThird === last, 'countdown lastThird', now, c)
      prevFrac = c.frac; prevPhase = `${c.next}${c.iqama}`
    }
  }
  check(countdown(t, t.dhuhr - 1, base).frac > 0.99 && countdown(t, t.fajr, base).frac === 0, 'countdown ends')
  console.log(`countdown: ${mins} minutes checked (next, left, progress, urgent, iqama, last third)`)
}

if (fail) { console.log('FAILURES:', fail); process.exit(1) } else console.log('ALL OK')
