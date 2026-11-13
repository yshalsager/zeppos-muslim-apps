// Face settings, stored as one JSON value. Pure logic, no storage: watchface/index.js reads and
// writes them through lib/store.js.
//
// One home per setting:
//  - face menu (tap the date line): everything the face calculates. Location, method, Asr school,
//    Hijri offset / day start, iqama, extra Fajr/Isha, sunrise window, minute adjustments, 12/24h,
//    and the language.
//    Defaults come from config.js.
//  - Edit slots (long-press → Edit): how it looks. Digits and the extras row.
import { METHOD_KEYS, autoMethod } from './methods.js'
import { LANG_CODES } from './i18n/index.js'

export const SETTINGS_KEY = 'settings'
export const ADJUST_KEYS = ['fajr', 'sunrise', 'dhuhr', 'asr', 'maghrib', 'isha']
export const SUNRISE_WINDOWS = [10, 15, 20]
export const CLOCKS = ['system', '12', '24']
export const LANGUAGES = ['auto', ...LANG_CODES]
// Quick fills for the per-prayer iqama minutes [fajr, dhuhr, asr, maghrib, isha]; names in lib/i18n (menu.presets)
export const IQAMA_PRESETS = [
  [0, 0, 0, 0, 0],
  [10, 10, 10, 5, 10],
  [20, 15, 15, 10, 15],
  [30, 20, 20, 10, 20],
]
export const LIMITS = {
  adjust: [-30, 30], // minutes
  iqama: [0, 60], // minutes, 0 = no iqama countdown
  angle: [12, 20], // degrees; below the minimum the extra time is off (0)
  hijriOffset: [-2, 2], // days
}

const clamp = (v, [lo, hi]) => Math.min(hi, Math.max(lo, v))
const int = (v, d) => (typeof v === 'number' && isFinite(v) ? Math.round(v) : d)
const bool = (v, d) => (typeof v === 'boolean' ? v : d)
const oneOf = (v, list, d) => (list.includes(v) ? v : d)
const angle = (v, d) => {
  if (typeof v !== 'number' || !isFinite(v)) return d
  return v < LIMITS.angle[0] ? 0 : Math.round(clamp(v, LIMITS.angle) * 10) / 10
}
const METHODS = ['auto', ...METHOD_KEYS]

export function defaultSettings(config) {
  return {
    method: config.method,
    asrFactor: config.asrFactor,
    hijriOffsetDays: config.hijriOffsetDays,
    hijriDayStartsAtMaghrib: config.hijriDayStartsAtMaghrib,
    iqama: [...config.iqama],
    iqamaJumuah: config.iqamaJumuah,
    extraFajrAngle: config.extraFajrAngle,
    extraIshaAngle: config.extraIshaAngle,
    sunriseWindowMin: config.sunriseWindowMin,
    adjust: { ...config.adjust },
    clock: config.clock,
    language: config.language,
  }
}

// Stored value (possibly old, partial or corrupt) → complete, in-range settings.
export function sanitizeSettings(stored, config) {
  const d = defaultSettings(config)
  const s = stored && typeof stored === 'object' ? stored : {}
  const adjust = {}
  for (const k of ADJUST_KEYS) adjust[k] = clamp(int(s.adjust && s.adjust[k], d.adjust[k] || 0), LIMITS.adjust)
  const iq = Array.isArray(s.iqama) ? s.iqama : d.iqama
  return {
    method: oneOf(s.method, METHODS, oneOf(d.method, METHODS, 'auto')),
    asrFactor: oneOf(s.asrFactor, [1, 2], d.asrFactor === 2 ? 2 : 1),
    hijriOffsetDays: clamp(int(s.hijriOffsetDays, d.hijriOffsetDays), LIMITS.hijriOffset),
    hijriDayStartsAtMaghrib: bool(s.hijriDayStartsAtMaghrib, d.hijriDayStartsAtMaghrib),
    iqama: d.iqama.map((def, i) => clamp(int(iq[i], def), LIMITS.iqama)),
    iqamaJumuah: clamp(int(s.iqamaJumuah, d.iqamaJumuah), LIMITS.iqama),
    extraFajrAngle: angle(s.extraFajrAngle, angle(d.extraFajrAngle, 0)),
    extraIshaAngle: angle(s.extraIshaAngle, angle(d.extraIshaAngle, 0)),
    sunriseWindowMin: oneOf(s.sunriseWindowMin, SUNRISE_WINDOWS, d.sunriseWindowMin),
    adjust,
    clock: oneOf(s.clock, CLOCKS, d.clock),
    language: oneOf(s.language, LANGUAGES, oneOf(d.language, LANGUAGES, 'auto')),
  }
}

// One stepper tap on an angle: off (0) ↔ the minimum, otherwise ±delta within the limits.
export function stepAngle(v, delta) {
  if (v === 0) return delta > 0 ? LIMITS.angle[0] : 0
  const next = Math.round((v + delta) * 10) / 10
  return next < LIMITS.angle[0] ? 0 : clamp(next, LIMITS.angle)
}

export const stepInt = (v, delta, limits) => clamp(v + delta, limits)

// The method in use: the chosen one, or for 'auto' the one for the location's country.
export const resolveMethod = (face, cc) => (face.method === 'auto' ? autoMethod(cc) : face.method)

// Index of the preset the minutes match, or -1 (custom minutes).
export const iqamaPreset = (mins) => IQAMA_PRESETS.findIndex((p) => p.every((v, i) => v === mins[i]))

// Effective settings: config.js ← face settings ← Edit slots, with the method and 12/24h resolved.
// env: { cc: location's country (or null), system24h: the watch's own time format }
export function effectiveSettings(config, face, edit, env) {
  const s = { ...config, ...face, ...edit }
  s.method = resolveMethod(face, env.cc)
  s.is24h = face.clock === 'system' ? !!env.system24h : face.clock === '24'
  return s
}
