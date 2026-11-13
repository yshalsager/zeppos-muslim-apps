// Prayer and related times via adhan-js (Meeus astronomical algorithms), adapted for the watch:
// adhan reads only the local Y/M/D of the input Date and returns absolute instants, so we
// convert those instants with our own timezone offset instead of trusting the runtime's TZ.
//
// Event definitions follow the Suntimes Prayer Times add-on (AddonEvents.kt / DaysMonthBuilder.kt).
import { Coordinates, CalculationMethod, HighLatitudeRule, Madhab, PrayerTimes } from 'adhan'

const uiof = () => {
  const p = CalculationMethod.Other()
  p.fajrAngle = 12
  p.ishaAngle = 12
  return p
}

// Order = order in the watch's Method edit slot.
export const METHODS = {
  egypt: () => CalculationMethod.Egyptian(), // 19.5° / 17.5°, Dhuhr +1 min
  mwl: () => CalculationMethod.MuslimWorldLeague(), // 18° / 17°
  karachi: () => CalculationMethod.Karachi(), // 18° / 18°
  isna: () => CalculationMethod.NorthAmerica(), // 15° / 15°
  makkah: () => CalculationMethod.UmmAlQura(), // 18.5° / Maghrib + 90 min
  uiof, // Union des Organisations Islamiques de France: 12° / 12°
  dubai: () => CalculationMethod.Dubai(),
  kuwait: () => CalculationMethod.Kuwait(),
  qatar: () => CalculationMethod.Qatar(),
  singapore: () => CalculationMethod.Singapore(),
  turkey: () => CalculationMethod.Turkey(), // Diyanet
  tehran: () => CalculationMethod.Tehran(),
  moonsighting: () => CalculationMethod.MoonsightingCommittee(),
}

export const PRAYER_ORDER = ['fajr', 'sunrise', 'dhuhr', 'asr', 'maghrib', 'isha']

// Prohibited-time presets (add-on: Prefs.apply_makruh_preset). Index = asrFactor.
export const MAKRUH_PRESETS = {
  1: { angle: 5, zawalMinutes: 10 }, // Shafi'i
  2: { angle: 5, zawalMinutes: 5 }, // Hanafi
}
export const EID_START_OFFSET_MIN = 15 // Eid prayer window: sunrise + 15 min .. noon

const NaNsafe = (v) => (typeof v === 'number' && isFinite(v) ? Math.round(v) : NaN)

/**
 * All times for one Gregorian date, as local minutes after midnight (NaN if the sun never
 * reaches the angle). opts: { lat, lon, tz (hours), method, asrFactor, adjust,
 *   sunriseWindowMin (10|15|20), extraFajrAngle?, extraIshaAngle? }
 */
export function dayEvents(y, m, d, opts) {
  const params = (METHODS[opts.method] || METHODS.egypt)()
  params.madhab = opts.asrFactor === 2 ? Madhab.Hanafi : Madhab.Shafi
  if (opts.adjust) params.adjustments = { ...params.adjustments, ...opts.adjust }

  const date = new Date(y, m - 1, d, 12) // noon: avoids DST-at-midnight edge cases
  const coords = new Coordinates(opts.lat, opts.lon)
  const pt = new PrayerTimes(coords, date, params)

  // Sun at an arbitrary altitude, via adhan's public API: an auxiliary PrayerTimes with no
  // adjustments whose "Fajr"/"Isha" angles are the depression we want (negative = above horizon).
  // MiddleOfTheNight keeps adhan's "safe Isha" fallback from replacing above-horizon times.
  const aux = (fajrAngle, ishaAngle) => {
    const p = CalculationMethod.Other()
    p.fajrAngle = fajrAngle
    p.ishaAngle = ishaAngle
    p.highLatitudeRule = HighLatitudeRule.MiddleOfTheNight
    return new PrayerTimes(coords, date, p)
  }
  const base = aux(18, 18) // astronomical sunrise / transit / sunset, without method adjustments

  const midnightUtc = Date.UTC(y, m - 1, d)
  const fromDate = (t) => (t && !isNaN(t.getTime()) ? NaNsafe((t.getTime() - midnightUtc) / 60000 + opts.tz * 60) : NaN)

  const e = {}
  for (const k of PRAYER_ORDER) e[k] = fromDate(pt[k])

  const makruh = MAKRUH_PRESETS[opts.asrFactor === 2 ? 2 : 1]
  const sunriseWindow = opts.sunriseWindowMin || 15
  const sunrise = fromDate(base.sunrise)
  const sunset = fromDate(base.sunset)
  const noon = fromDate(base.dhuhr) // solar transit

  e.noon = noon
  e.sunset = sunset
  e.duha = sunrise + sunriseWindow
  e.eidStart = sunrise + EID_START_OFFSET_MIN
  e.eidEnd = noon
  // Extra Fajr/Isha at user-chosen angles; skipped (NaN) when equal to the method's own angle,
  // e.g. 12° under UIOF, so the face doesn't show a duplicate.
  const same = (a, b) => Math.abs(a - b) < 1e-6
  e.methodFajrAngle = params.fajrAngle
  e.methodIshaAngle = params.ishaInterval > 0 ? null : params.ishaAngle // null: Isha is Maghrib + N min
  e.extraFajr = opts.extraFajrAngle && !same(opts.extraFajrAngle, params.fajrAngle)
    ? fromDate(aux(opts.extraFajrAngle, 18).fajr) : NaN
  e.extraIsha = opts.extraIshaAngle && !(e.methodIshaAngle !== null && same(opts.extraIshaAngle, params.ishaAngle))
    ? fromDate(aux(18, opts.extraIshaAngle).isha) : NaN

  // Prohibited (makruh) windows: [start, end]
  const sunsetStart = fromDate(aux(18, -makruh.angle).isha) // sun at +5° on its way down
  e.makruh = {
    dawn: [e.fajr, sunrise],
    sunrise: [sunrise, sunrise + sunriseWindow],
    zawal: [noon - makruh.zawalMinutes, noon],
    afterAsr: [e.asr, sunsetStart],
    sunset: [sunsetStart, sunset],
  }
  return e
}

/** Night portions between Maghrib and the next Fajr (minutes; may exceed 1440). */
export function nightPortions(maghrib, nextFajr) {
  const len = nextFajr - maghrib
  if (!(len > 0)) return null
  return {
    firstThird: Math.round(maghrib + len / 3),
    midpoint: Math.round(maghrib + len / 2),
    lastThird: Math.round(nextFajr - len / 3),
    lastSixth: Math.round(nextFajr - len / 6),
  }
}

/** Backwards-compatible: just the six main times. */
export function prayerMinutes(y, m, d, opts) {
  const e = dayEvents(y, m, d, opts)
  const out = {}
  for (const k of PRAYER_ORDER) out[k] = e[k]
  return out
}
