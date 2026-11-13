// Screens of the face's settings menu (watchface/menu.js), opened by tapping the date line.
// They edit `ctx.face` (lib/settings.js) in place and call ctx.changed(); watchface/index.js saves
// and applies the settings when the menu closes. Picking a city saves immediately.
import { cityGroups, countryCities, cityName } from '../lib/city-data.js'
import { METHOD_KEYS } from '../lib/methods.js'
import { HIGH_LAT_RULES, resolveHighLat } from '../lib/prayer.js'
import { LANGS, LANG_CODES } from '../lib/i18n/index.js'
import {
  ADJUST_KEYS, CLOCKS, IQAMA_PRESETS, LIMITS, SUNRISE_WINDOWS, iqamaPreset, stepAngle, stepCoord, stepInt,
} from '../lib/settings.js'

const IQAMA_PRAYERS = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha']
const next = (list, v) => list[(list.indexOf(v) + 1) % list.length]

// ctx: { face, T (lib/i18n strings), lang, watchLang(), changed(), close(),
//   setCity(name, lat, lon, cc, latin) / setCity(null), setCoords(lat, lon), position() ({ lat, lon }
//   in use), place(), message(s), digits(s), accent, autoMethod(), hijri(), times(opts?) } — the last
//   three preview the settings being edited (times: with opts overriding them, e.g. { lat, lon }).
export function rootScreen(ctx) {
  const { face, digits, T } = ctx
  const M = T.menu
  const minutes = (v) => (v ? T.minutes(digits(v)) : M.off)
  const signed = (v) => (v > 0 ? '+' : v < 0 ? '-' : '') + digits(Math.abs(v))
  const degrees = (v) => (v ? `${digits(v.toFixed(1))}°` : M.off)
  const set = (fn) => () => { fn(); ctx.changed() }
  const chosen = (on) => (on ? ctx.accent : undefined)

  // Location: group → country → (region, for long lists) → city. Files are read when a screen opens.
  // A list longer than 3 pages opens on an index of 4 ranges, each named by its first and last
  // entry; a range that is still long gets its own index (117 cities: 2 index taps, then ≤ 2 pages).
  const MAX_ROWS = 12
  const RANGES = 4
  const short = (s) => (s.length <= 12 ? s : s.split(' ')[0])
  const list = (title, rows) => {
    if (rows.length <= MAX_ROWS) return { title, items: () => rows }
    const size = Math.ceil(rows.length / RANGES)
    const parts = []
    for (let i = 0; i < rows.length; i += size) parts.push(rows.slice(i, i + size))
    return {
      title,
      items: () => parts.map((part) => ({
        label: `${short(part[0].label)} … ${short(part[part.length - 1].label)}`,
        tap: () => list(title, part),
      })),
    }
  }
  // The files are sorted for Arabic; other languages show Latin names, sorted here.
  const sorted = (rows) => (T.rtl ? rows : rows.slice().sort((a, b) => (a.label < b.label ? -1 : a.label > b.label ? 1 : 0)))
  const unreadable = () => ctx.message(M.cantReadCities)
  const country = (cc, name) => () => {
    const data = countryCities(cc)
    if (!data) return unreadable()
    const pick = (row) => {
      const [ar, lat, lon] = row
      return { label: cityName(row, T.rtl), tap: () => ctx.setCity(ar, lat / 100, lon / 100, cc, row[3]) }
    }
    if (data.cities) return list(name, sorted(data.cities.map(pick)))
    return list(name, sorted(data.regions.map((r) => {
      const region = cityName([r[0], 0, 0, r[2]], T.rtl)
      return { label: region, tap: () => list(region, sorted(r[1].map(pick))) }
    })))
  }
  // Coordinates: start from the location in use, 1° on the big buttons and 0.1° underneath; the title
  // shows today's Fajr / Isha there. Nothing is saved until "use these coordinates".
  const prayerTimes = (opts) => {
    const t = ctx.times(opts)
    return `${T.prayers.fajr} ${t.fajr}  •  ${T.prayers.isha} ${t.isha}`
  }
  const deg = (v) => `${v < 0 ? '-' : ''}${digits(Math.abs(v).toFixed(1))}°`
  const coords = () => {
    const p = ctx.position()
    const draft = { lat: Math.round(p.lat * 10) / 10, lon: Math.round(p.lon * 10) / 10 }
    const preview = () => prayerTimes(draft)
    const row = (label, key) => {
      const by = (delta) => () => { draft[key] = stepCoord(draft[key], delta, key === 'lon') }
      return { label, title: preview, value: () => deg(draft[key]), dec: by(-1), inc: by(1), fine: { label: digits('0.1'), dec: by(-0.1), inc: by(0.1) } }
    }
    return {
      title: preview,
      items: () => [
        row(M.latitude, 'lat'),
        row(M.longitude, 'lon'),
        { label: M.useCoords, color: ctx.accent, tap: () => ctx.setCoords(draft.lat, draft.lon) },
      ],
    }
  }
  const location = () => {
    const groups = cityGroups(ctx.lang)
    if (!groups) return unreadable()
    return list(M.location, [
      { label: M.locationFromApp, color: ctx.accent, tap: () => ctx.setCity(null) },
      ...groups.map(([key, countries]) => ({
        label: M.groups[key],
        tap: () => list(M.groups[key], sorted(countries.map(([cc, name]) => ({ label: name, tap: country(cc, name) })))),
      })),
      { label: M.coords, tap: coords },
    ])
  }

  // Method: picking one stays on the list, and the title shows today's Fajr / Isha with it.
  const methodName = () => T.methods[face.method === 'auto' ? ctx.autoMethod() : face.method]
  const method = {
    title: () => prayerTimes(),
    items: () => [
      { label: M.auto, value: () => T.methods[ctx.autoMethod()], color: chosen(face.method === 'auto'), tap: set(() => { face.method = 'auto' }) },
      ...METHOD_KEYS.map((k) => ({ label: T.methods[k], color: chosen(face.method === k), tap: set(() => { face.method = k }) })),
    ],
  }

  // High latitudes: like the method, picking one stays on the list and the title shows today's
  // Fajr / Isha with it. Names are too long for a row's value column, so "auto" names its rule in brackets.
  const highLat = {
    title: () => prayerTimes(),
    items: () => HIGH_LAT_RULES.map((k) => ({
      label: k === 'auto' ? `${M.auto} (${M.highLatRules[resolveHighLat('auto', ctx.position().lat)]})` : M.highLatRules[k],
      color: chosen(face.highLatRule === k),
      tap: set(() => { face.highLatRule = k }),
    })),
  }

  // Language: picking one closes the menu, and the face is rebuilt in it (watchface/index.js).
  const pickLanguage = (code) => () => {
    face.language = code
    ctx.changed()
    ctx.close()
  }
  const language = {
    title: M.language,
    items: () => [
      { label: `${M.auto} (${LANGS[ctx.watchLang()].name})`, plain: true, color: chosen(face.language === 'auto'), tap: pickLanguage('auto') },
      ...LANG_CODES.map((code) => ({ label: LANGS[code].name, plain: true, color: chosen(face.language === code), tap: pickLanguage(code) })),
    ],
  }

  // Hijri: the title shows today's date with the settings being edited.
  const hijri = {
    title: () => ctx.hijri(),
    items: () => [
      {
        label: M.hijriOffset,
        title: () => ctx.hijri(), // the value screen shows the resulting date
        value: () => signed(face.hijriOffsetDays),
        dec: set(() => { face.hijriOffsetDays = stepInt(face.hijriOffsetDays, -1, LIMITS.hijriOffset) }),
        inc: set(() => { face.hijriOffsetDays = stepInt(face.hijriOffsetDays, 1, LIMITS.hijriOffset) }),
      },
      {
        label: M.dayStart,
        value: () => (face.hijriDayStartsAtMaghrib ? M.atMaghrib : M.atMidnight),
        tap: set(() => { face.hijriDayStartsAtMaghrib = !face.hijriDayStartsAtMaghrib }),
      },
    ],
  }

  // Iqama: a preset fills the minutes; each prayer can then be changed (0 = no iqama countdown).
  const presetName = () => {
    const i = iqamaPreset(face.iqama)
    return i < 0 ? M.custom : M.presets[i]
  }
  const iqamaRow = (label, get, put) => ({
    label,
    value: () => minutes(get()),
    dec: set(() => put(stepInt(get(), -1, LIMITS.iqama))),
    inc: set(() => put(stepInt(get(), 1, LIMITS.iqama))),
  })
  const iqama = {
    title: M.iqamaTitle,
    items: () => [
      {
        label: M.preset,
        value: presetName,
        tap: set(() => {
          const i = iqamaPreset(face.iqama)
          face.iqama = [...IQAMA_PRESETS[(i + 1) % IQAMA_PRESETS.length]] // custom → the first preset
        }),
      },
      ...IQAMA_PRAYERS.map((k, i) => iqamaRow(T.prayers[k], () => face.iqama[i], (v) => { face.iqama[i] = v })),
      iqamaRow(T.jumuah, () => face.iqamaJumuah, (v) => { face.iqamaJumuah = v }),
    ],
  }

  // Extra Fajr / Isha at chosen angles: 1° on the big buttons, 0.1° underneath; below 12° = off
  const angleRow = (label, key) => ({
    label,
    value: () => degrees(face[key]),
    dec: set(() => { face[key] = stepAngle(face[key], -1) }),
    inc: set(() => { face[key] = stepAngle(face[key], 1) }),
    fine: {
      label: digits('0.1'),
      dec: set(() => { face[key] = stepAngle(face[key], -0.1) }),
      inc: set(() => { face[key] = stepAngle(face[key], 0.1) }),
    },
  })
  const extras = {
    title: M.extras,
    items: () => [
      angleRow(M.extraFajr, 'extraFajrAngle'),
      angleRow(M.extraIsha, 'extraIshaAngle'),
      {
        label: M.sunriseWindow,
        value: () => minutes(face.sunriseWindowMin),
        tap: set(() => { face.sunriseWindowMin = next(SUNRISE_WINDOWS, face.sunriseWindowMin) }),
      },
    ],
  }

  const adjust = {
    title: M.adjustTitle,
    items: () => ADJUST_KEYS.map((k) => ({
      label: T.prayers[k],
      value: () => signed(face.adjust[k]),
      dec: set(() => { face.adjust[k] = stepInt(face.adjust[k], -1, LIMITS.adjust) }),
      inc: set(() => { face.adjust[k] = stepInt(face.adjust[k], 1, LIMITS.adjust) }),
    })),
  }

  const CLOCK_NAMES = { system: M.auto, 12: digits('12'), 24: digits('24') }

  // First page (4 rows): what most people set once — location, method, Hijri, iqama
  return {
    title: M.settings,
    items: () => [
      { label: M.location, value: ctx.place, tap: location },
      { label: M.method, value: methodName, tap: () => method },
      { label: M.hijri, value: () => (face.hijriOffsetDays ? signed(face.hijriOffsetDays) : M.hijriDefault), tap: () => hijri },
      { label: M.iqama, value: presetName, tap: () => iqama },
      {
        label: M.asr,
        value: () => (face.asrFactor === 2 ? M.asrHanafi : M.asrMajority),
        tap: set(() => { face.asrFactor = face.asrFactor === 2 ? 1 : 2 }),
      },
      { label: M.highLat, tap: () => highLat },
      { label: M.extras, tap: () => extras },
      { label: M.adjust, tap: () => adjust },
      { label: M.clock, value: () => CLOCK_NAMES[face.clock], tap: set(() => { face.clock = next(CLOCKS, face.clock) }) },
      // a chosen language is the one shown, so its own name fits the row's font
      { label: M.language, value: () => (face.language === 'auto' ? M.auto : LANGS[face.language].name), tap: () => language },
    ],
  }
}
