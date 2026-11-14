// Checks lib/ against independent references. Run: pnpm test  (try also TZ=Pacific/Auckland pnpm test)
import { Coordinates, CalculationMethod, HighLatitudeRule, Madhab, PrayerTimes } from 'adhan'
import { prayerMinutes, dayEvents, nightPortions, resolveHighLat, HIGH_LAT_RULES, METHODS, PRAYER_ORDER } from '../lib/prayer.js'
import { hijriFromEpochDay, epochDay } from '../lib/hijri.js'
import { countdown, URGENT_MIN } from '../lib/countdown.js'
import { sanitizeSettings, defaultSettings, effectiveSettings, stepAngle, stepCoord, stepInt, iqamaPreset, LIMITS, IQAMA_PRESETS } from '../lib/settings.js'
import { METHOD_KEYS, autoMethod } from '../lib/methods.js'
import { LANG_CODES, LANG_NAMES, resolveLang, revive } from '../lib/i18n/index.js'
import { LANGS } from '../lib/i18n/tables.js'
import { gregLine } from '../lib/i18n/text.js'
import { EDIT_GROUPS } from '../lib/edit-options.js'
import { layout, DESIGN } from '../lib/layout.js'
import { CONFIG } from '../config.js'
import { utf8 } from '../lib/utf8.js'
import { readFileSync, existsSync } from 'node:fs'

const DEVICES = JSON.parse(readFileSync(new URL('../devices.json', import.meta.url), 'utf8'))
const TARGETS = Object.keys(DEVICES).filter((k) => !k.startsWith('/'))
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
// High-latitude rule: London at midsummer, where the sun never reaches 18° below the horizon.
// Each rule matches adhan given that rule directly; 'auto' is the seventh above 48° (either
// hemisphere) and the middle below; in Cairo every rule but the seventh leaves the times alone.
let highLatChecks = 0
{
  const tzMin = 60 // BST
  const london = { lat: 51.5074, lon: -0.1278, tz: tzMin / 60, method: 'mwl', asrFactor: 1 }
  const RULE = { middle: HighLatitudeRule.MiddleOfTheNight, seventh: HighLatitudeRule.SeventhOfTheNight, twilight: HighLatitudeRule.TwilightAngle }
  const mins = (t) => Math.round((t.getTime() - Date.UTC(2026, 5, 21)) / 60000) + tzMin
  const got = {}
  for (const rule of HIGH_LAT_RULES) {
    const e = dayEvents(2026, 6, 21, { ...london, highLatRule: rule })
    const params = CalculationMethod.MuslimWorldLeague()
    params.highLatitudeRule = RULE[resolveHighLat(rule, london.lat)]
    const ref = new PrayerTimes(new Coordinates(london.lat, london.lon), new Date(2026, 5, 21, 12), params)
    check(e.fajr === mins(ref.fajr) && e.isha === mins(ref.isha), 'high latitude vs adhan', rule, e.fajr, mins(ref.fajr), e.isha, mins(ref.isha))
    got[rule] = e
    highLatChecks++
  }
  check(got.auto.fajr === got.seventh.fajr && got.middle.fajr < got.seventh.fajr - 60, 'london rules differ', got.middle.fajr, got.seventh.fajr)
  check(resolveHighLat('auto', -50) === 'seventh' && resolveHighLat('auto', 30) === 'middle' && resolveHighLat('twilight', 60) === 'twilight', 'auto rule by latitude')
  const cairo = { lat: 30.0444, lon: 31.2357, tz: 2, method: 'egypt', asrFactor: 1 }
  for (const d of [[2026, 6, 21], [2026, 12, 21]]) {
    const a = dayEvents(...d, cairo)
    for (const rule of ['auto', 'middle', 'twilight']) {
      const b = dayEvents(...d, { ...cairo, highLatRule: rule })
      check(a.fajr === b.fajr && a.isha === b.isha, 'cairo unaffected', rule, d)
      highLatChecks++
    }
  }
}
const np = nightPortions(17 * 60 + 1, 24 * 60 + 4 * 60 + 49)
check(np.firstThird === 20 * 60 + 57 && np.midpoint === 22 * 60 + 55 && np.lastThird === 24 * 60 + 53 && np.lastSixth === 26 * 60 + 51, 'night portions', np)
for (const k of Object.keys(METHODS)) {
  const t = prayerMinutes(2026, 11, 12, { lat: 30.0444, lon: 31.2357, tz: 2, method: k, asrFactor: 1 })
  check(PRAYER_ORDER.every((p, i) => !isNaN(t[p]) && (i === 0 || t[p] > t[PRAYER_ORDER[i - 1]])), 'method order', k, t)
}
console.log(`events: ${angleChecks} sun-altitude checks within 0.3°, windows match add-on definitions, ${Object.keys(METHODS).length} methods ordered, ${highLatChecks} high-latitude checks`)

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

// Face settings: whatever is stored (missing, old, corrupt) becomes complete and in range
{
  const d = defaultSettings(CONFIG)
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b)
  check(same(sanitizeSettings(null, CONFIG), sanitizeSettings(d, CONFIG)), 'settings defaults')
  check(same(sanitizeSettings('junk', CONFIG), sanitizeSettings(null, CONFIG)), 'settings junk')
  // an old stored value (before the menu held the calculation settings) keeps what still applies
  const old = sanitizeSettings({ iqamaCustom: [5, 5, 5, 5, 5], is24h: true, customFajrAngle: 14.6, sunriseWindowMin: 20 }, CONFIG)
  check(same(old.iqama, CONFIG.iqama) && old.clock === CONFIG.clock && old.extraFajrAngle === CONFIG.extraFajrAngle && old.sunriseWindowMin === 20, 'settings old keys', old)
  const s = sanitizeSettings({ adjust: { fajr: 99, isha: -3.4, asr: 'x' }, iqama: [5, -1, 200], iqamaJumuah: 30,
    clock: '24', sunriseWindowMin: 12, extraFajrAngle: 14.6, extraIshaAngle: 5, method: 'nope', asrFactor: 3,
    hijriOffsetDays: -7, hijriDayStartsAtMaghrib: 'yes' }, CONFIG)
  check(s.adjust.fajr === 30 && s.adjust.isha === -3 && s.adjust.asr === CONFIG.adjust.asr && s.adjust.sunrise === 0, 'settings adjust', s.adjust)
  check(same(s.iqama, [5, 0, 60, CONFIG.iqama[3], CONFIG.iqama[4]]) && s.iqamaJumuah === 30, 'settings iqama', s.iqama)
  check(s.clock === '24' && s.sunriseWindowMin === CONFIG.sunriseWindowMin, 'settings toggles', s)
  check(s.extraFajrAngle === 14.6 && s.extraIshaAngle === 0, 'settings angles', s)
  check(s.method === 'auto' && s.asrFactor === 1 && s.hijriOffsetDays === -2 && s.hijriDayStartsAtMaghrib === false, 'settings calc', s)
  // angle stepper: off ↔ minimum, 0.1° steps without float drift, clamped at the maximum
  let a = 0
  a = stepAngle(a, 0.1); check(a === LIMITS.angle[0], 'angle on', a)
  for (let i = 0; i < 26; i++) a = stepAngle(a, 0.1)
  check(a === 14.6, 'angle fine steps', a)
  check(stepAngle(LIMITS.angle[0], -0.1) === 0 && stepAngle(19.5, 1) === LIMITS.angle[1], 'angle limits')
  check(stepInt(30, 1, LIMITS.adjust) === 30 && stepInt(0, -1, LIMITS.iqama) === 0, 'int limits')
  check(iqamaPreset(IQAMA_PRESETS[2]) === 2 && iqamaPreset([1, 2, 3, 4, 5]) === -1, 'iqama presets')
  // method: automatic by country (unknown → MWL), or the chosen one; Edit slots only set looks
  const env = { cc: 'SA', system24h: true }
  const e = effectiveSettings(CONFIG, { ...s, method: 'auto', clock: 'system' }, { arabicDigits: false }, env)
  check(e.method === 'makkah' && e.is24h === true && e.arabicDigits === false && e.iqama === s.iqama, 'effective auto', e.method, e.is24h)
  check(effectiveSettings(CONFIG, { ...s, method: 'mwl', clock: '12' }, {}, env).method === 'mwl', 'effective chosen method')
  check(effectiveSettings(CONFIG, { ...s, clock: '12' }, {}, env).is24h === false, 'effective 12h override')
  check(autoMethod('EG') === 'egypt' && autoMethod('PK') === 'karachi' && autoMethod('TR') === 'turkey' &&
    autoMethod('US') === 'isna' && autoMethod('DE') === 'mwl' && autoMethod(undefined) === 'mwl', 'auto method')
  // the menu's method list and the auto table only name methods lib/prayer.js knows
  const keys = METHOD_KEYS
  check(keys.length === Object.keys(METHODS).length && keys.every((k) => METHODS[k]), 'method list', keys)
  const ccs = JSON.parse(readFileSync(new URL(`../assets/${TARGETS[0]}/cities/index.json`, import.meta.url), 'utf8'))
    .groups.flatMap(([, cs]) => cs.map(([cc]) => cc))
  check(sanitizeSettings({ language: 'fr' }, CONFIG).language === 'fr' && sanitizeSettings({ language: 'xx' }, CONFIG).language === CONFIG.language, 'settings language')
  check(ccs.every((cc) => METHODS[autoMethod(cc)]), 'auto method for every country')
  check(sanitizeSettings({ highLatRule: 'seventh' }, CONFIG).highLatRule === 'seventh' &&
    sanitizeSettings({ highLatRule: 'nope' }, CONFIG).highLatRule === CONFIG.highLatRule, 'settings high latitude')
  // Coordinates: 0.1° steps without float drift, latitude stops at ±90, longitude wraps at ±180
  let c = 30
  for (let i = 0; i < 4; i++) c = stepCoord(c, 0.1, false)
  check(c === 30.4, 'coord fine steps', c)
  check(stepCoord(89.5, 1, false) === 90 && stepCoord(-89.9, -0.1, false) === -90, 'latitude limits')
  check(stepCoord(179.9, 0.1, true) === 180 && stepCoord(180, 0.1, true) === -179.9 && stepCoord(-179.9, -0.1, true) === 180 &&
    stepCoord(179.5, 1, true) === -179.5, 'longitude wraps', stepCoord(180, 0.1, true), stepCoord(179.5, 1, true))
  console.log('settings: sanitize, steppers, coordinates, presets, automatic method and 12/24h')
}

// City files (tools/gen-cities.py): every listed country has a file, names use only letters the
// font shapes, coordinates are valid, regions are consistent; and the watch's UTF-8 decoder
{
  const dir = new URL(`../assets/${TARGETS[0]}/cities/`, import.meta.url)
  const sample = 'مكة المكرمة · Zürich · 😀'
  check(utf8(new TextEncoder().encode(sample)) === sample, 'utf8 decode')
  const index = JSON.parse(readFileSync(new URL('index.json', dir), 'utf8'))
  // Arabic names: letters the font shapes, or ASCII; Latin names: ASCII
  const NAME = /^([\u0621-\u063a\u0641-\u064a ()\-]+|[\x20-\x7e]+)$/
  const LATIN = /^[\x20-\x7e]+$/
  check(JSON.stringify(index.langs) === JSON.stringify(LANG_CODES), 'city index languages = lib/i18n', index.langs)
  let n = 0, files = 0
  const all = new Map()
  for (const [group, countries] of index.groups) {
    check(LANGS.ar.menu.groups[group] && countries.length > 0, 'city group', group)
    for (const [cc, name, ...names] of countries) {
      check(NAME.test(name), 'country name', cc, name)
      check(names.length === LANG_CODES.length - 1 && names.every((x) => typeof x === 'string' && x), 'country names', cc, names)
      const f = new URL(`${cc}.json`, dir)
      if (!existsSync(f)) { check(false, 'country file missing', cc); continue }
      const data = JSON.parse(readFileSync(f, 'utf8'))
      files++
      check(Array.isArray(data.cities) !== Array.isArray(data.regions), 'cities xor regions', cc)
      const lists = data.cities ? [data.cities] : data.regions.map(([r, cs, latin]) => {
        check(NAME.test(r) && cs.length > 0 && (latin === undefined || LATIN.test(latin)), 'region', cc, r, latin)
        return cs
      })
      for (const [city, lat100, lon100, latin] of lists.flat()) {
        n++
        check(latin === undefined || (LATIN.test(latin) && latin !== city), 'city latin name', cc, city, latin)
        const lat = lat100 / 100, lon = lon100 / 100
        all.set(`${cc}:${city}`, [lat, lon])
        check(NAME.test(city), 'city name', cc, city)
        check(Number.isInteger(lat100) && Number.isInteger(lon100), 'city coords are hundredths', cc, city)
        check(Math.abs(lat) <= 90 && Math.abs(lon) <= 180 && !(lat === 0 && lon === 0), 'city coords', cc, city)
      }
    }
  }
  const near = (key, lat, lon) => { const p = all.get(key); return p && Math.abs(p[0] - lat) < 0.2 && Math.abs(p[1] - lon) < 0.2 }
  check(near('EG:القاهرة', 30.04, 31.24) && near('SA:مكة المكرمة', 21.42, 39.83) && near('SA:المدينة المنورة', 24.47, 39.61), 'key cities', [...all.keys()].filter((k) => /^SA:م/.test(k)))
  console.log(`cities: ${n} in ${files} country files, names/coords/regions valid`)
}

// Languages: every one has ar.js's keys with the same shapes (array lengths, function or not),
// every method / edit label / group is named, and 'auto' maps the watch's language.
{
  const shape = (v) => (Array.isArray(v) ? `array${v.length}` : typeof v === 'object' ? 'object' : typeof v)
  const compare = (ref, other, path) => {
    for (const k of Object.keys(ref)) {
      check(k in other && shape(ref[k]) === shape(other[k]), 'i18n key', path + k, shape(other[k]))
      if (k in other && shape(ref[k]) === 'object') compare(ref[k], other[k], path + k + '.')
      if (k in other && Array.isArray(ref[k])) other[k].forEach((x, i) => check(typeof x === 'string', 'i18n entry', path + k, i))
    }
    for (const k of Object.keys(other)) check(k in ref, 'i18n extra key', path + k)
  }
  for (const code of LANG_CODES) {
    const T = LANGS[code]
    compare(LANGS.ar, T, code + ':')
    check(METHOD_KEYS.every((k) => T.methods[k]), 'i18n methods', code)
    check(EDIT_GROUPS.every((g) => g.options.every((o) => T.edit[o.label])), 'i18n edit labels', code)
    check(T.menu.presets.length === IQAMA_PRESETS.length, 'i18n iqama presets', code)
    check(typeof T.nextIn('a', 'b') === 'string' && T.minutes('5').includes('5'), 'i18n functions', code)
    check(T.rtl === (code === 'ar'), 'i18n direction', code)
  }
  check(resolveLang('auto', 13) === 'ar' && resolveLang('auto', 17) === 'tr' && resolveLang('auto', 0) === 'en' &&
    resolveLang('auto', undefined) === 'en' && resolveLang('fr', 13) === 'fr', 'language resolution')
  // The watch reads assets/<target>/i18n/<lang>.json (tools/gen-i18n.mjs): same strings, templates give the same text
  const p = { d: '1', mon: 'M', m: '2', y: '3', wd: 'W' }
  for (const target of TARGETS) {
    for (const code of LANG_CODES) {
      const path = new URL(`../assets/${target}/i18n/${code}.json`, import.meta.url)
      if (!existsSync(path)) { check(false, 'i18n json missing', target, code); continue }
      const T = revive(readFileSync(path, 'utf8')), ref = LANGS[code]
      check(T.name === LANG_NAMES[code], 'language name', code)
      for (const k of Object.keys(ref)) {
        const same = typeof ref[k] === 'function'
          ? ref[k](p, 'b') === T[k](p, 'b') && ref[k]('a', 'b') === T[k]('a', 'b')
          : JSON.stringify(ref[k]) === JSON.stringify(T[k])
        check(same, 'i18n json', target, code, k)
      }
    }
  }
// Date line: the year only without a place; a long place is cut with "…" (tools/gen-text-width.py
// checks the fit in the real fonts), a short one or coordinates are kept whole.
{
  const box = layout().greg
  const day = { weekday: 3, d: 30, m: 9, y: 2026 }
  for (const lang of LANG_CODES) {
    const T = LANGS[lang]
    const id = (s) => String(s)
    check(gregLine(T, day, id).includes('2026') && !gregLine(T, day, id, T.fallbackPlace, box).includes('2026'), 'date line year', lang)
    check(gregLine(T, day, id, T.fallbackPlace, box).endsWith(T.fallbackPlace), 'date line short place', lang)
    // coordinates: to 0.1° when they fit, else whole degrees, never cut (worst: long date, 3-digit longitude)
    for (let weekday = 0; weekday < 7; weekday++) {
      for (let m = 1; m <= 12; m++) {
        const s = gregLine(T, { weekday, d: 28, m, y: 2026 }, id, [T.coords('-36.8', '-174.8'), T.coords('-37', '-175')], box)
        check(!s.endsWith('…'), 'date line coordinates not cut', lang, s)
      }
    }
    const long = gregLine(T, day, id, 'Santo Domingo de los Colorados', box)
    check(long.endsWith('…') && long.length < 40, 'date line long place cut', lang, long)
    check(gregLine(T, day, id, 'Santo Domingo de los Colorados').endsWith('Colorados'), 'date line without box keeps the place', lang)
  }
}
  console.log(`i18n: ${LANG_CODES.join(', ')} have every key of ar.js`)
}

// Devices: devices.json and app.json name the same targets, each with its assets folder; every
// layout box stays on its screen, and the design size is laid out as designed (scale 1).
{
  const app = JSON.parse(readFileSync(new URL('../app.json', import.meta.url), 'utf8'))
  check(JSON.stringify(Object.keys(app.targets)) === JSON.stringify(TARGETS), 'app.json targets = devices.json', Object.keys(app.targets), TARGETS)
  for (const t of TARGETS) {
    const d = DEVICES[t]
    const p = app.targets[t] && app.targets[t].platforms
    check(p && p.some((x) => x.deviceSource === d.deviceSource), 'app.json deviceSource', t)
    check(existsSync(new URL(`../assets/${t}/icon.png`, import.meta.url)), 'target assets', t)
    check(existsSync(new URL(`../assets/${t}/NOTICE.txt`, import.meta.url)), 'license notices in the package', t)
    const L = layout(d.width, d.height)
    const boxes = []
    const walk = (v) => {
      if (Array.isArray(v)) v.forEach(walk)
      else if (v && typeof v === 'object') {
        if ('x' in v && 'w' in v) boxes.push(v)
        else Object.values(v).forEach(walk)
      }
    }
    walk(L)
    check(boxes.every((b) => b.x >= 0 && b.y >= 0 && b.x + b.w <= d.width && b.y + b.h <= d.height), 'layout boxes on screen', t)
  }
  const L = layout(DESIGN.width, DESIGN.height)
  check(L.hijri.x === 16 && L.hijri.text_size === 32 && L.comps[0].icon.x === 368 && L.menu.row[3].tap.y === 330, 'design layout unscaled')
  console.log(`devices: ${TARGETS.join(', ')} match app.json; layout boxes fit their screens`)
}

// The face reads the companion's shared location by its appId; a mismatch fails silently on the watch.
// Both come from the root mise.toml's [env] via `mise run :gen` (scripts/app-ids.py).
{
  const { LOCATION_APP_ID: id } = await import('../lib/app-ids.js')
  const companion = JSON.parse(readFileSync(new URL('../../prayer-location-app/app.json', import.meta.url), 'utf8')).app.appId
  check(id === companion, 'lib/app-ids.js LOCATION_APP_ID matches prayer-location-app/app.json (run mise run :gen)', id, companion)
  console.log(`location app id: ${id} matches the companion's app.json`)
}

if (fail) { console.log('FAILURES:', fail); process.exit(1) } else console.log('ALL OK')
