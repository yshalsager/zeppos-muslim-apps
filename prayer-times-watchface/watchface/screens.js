// Screens of the face's settings menu (watchface/menu.js), opened by tapping the date line.
// They edit `ctx.face` (lib/settings.js) in place and call ctx.changed(); watchface/index.js saves
// and applies the settings when the menu closes. Picking a city saves immediately.
import { cityGroups, countryCities } from '../lib/city-data.js'
import { PRAYER_NAMES_AR, JUMUAH_AR } from '../lib/prayer.js'
import { METHOD_LIST, METHOD_NAMES } from '../lib/methods.js'
import {
  ADJUST_KEYS, CLOCKS, IQAMA_PRESETS, LIMITS, SUNRISE_WINDOWS, iqamaPreset, stepAngle, stepInt,
} from '../lib/settings.js'

const IQAMA_PRAYERS = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha']
const next = (list, v) => list[(list.indexOf(v) + 1) % list.length]

// ctx: { face, changed(), setCity(name, lat, lon, cc) / setCity(null), place(), message(s), digits(s),
//   accent, autoMethod(), hijri(), times() } — the last three preview the settings being edited.
export function rootScreen(ctx) {
  const { face, digits } = ctx
  const minutes = (v) => (v ? `${digits(v)} د` : 'بدون')
  const signed = (v) => (v > 0 ? '+' : v < 0 ? '-' : '') + digits(Math.abs(v))
  const degrees = (v) => (v ? `${digits(v.toFixed(1))}°` : 'بدون')
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
  const unreadable = () => ctx.message('تعذر قراءة المدن')
  const country = (cc, name) => () => {
    const data = countryCities(cc)
    if (!data) return unreadable()
    const pick = ([city, lat, lon]) => ({ label: city, tap: () => ctx.setCity(city, lat / 100, lon / 100, cc) })
    if (data.cities) return list(name, data.cities.map(pick))
    return list(name, data.regions.map(([region, cities]) => ({ label: region, tap: () => list(region, cities.map(pick)) })))
  }
  const location = () => {
    const groups = cityGroups()
    if (!groups) return unreadable()
    return list('الموقع', [
      { label: 'الموقع من التطبيق', color: ctx.accent, tap: () => ctx.setCity(null) },
      ...groups.map(([group, countries]) => ({
        label: group,
        tap: () => list(group, countries.map(([cc, name]) => ({ label: name, tap: country(cc, name) }))),
      })),
    ])
  }

  // Method: picking one stays on the list, and the title shows today's Fajr / Isha with it.
  const methodName = () => METHOD_NAMES[face.method === 'auto' ? ctx.autoMethod() : face.method]
  const method = {
    title: () => {
      const t = ctx.times()
      return `الفجر ${t.fajr}  •  العشاء ${t.isha}`
    },
    items: () => [
      { label: 'تلقائي', value: () => METHOD_NAMES[ctx.autoMethod()], color: chosen(face.method === 'auto'), tap: set(() => { face.method = 'auto' }) },
      ...METHOD_LIST.map(([k, name]) => ({ label: name, color: chosen(face.method === k), tap: set(() => { face.method = k }) })),
    ],
  }

  // Hijri: the title shows today's date with the settings being edited.
  const hijri = {
    title: () => ctx.hijri(),
    items: () => [
      {
        label: 'تعديل (أيام)',
        title: () => ctx.hijri(), // the value screen shows the resulting date
        value: () => signed(face.hijriOffsetDays),
        dec: set(() => { face.hijriOffsetDays = stepInt(face.hijriOffsetDays, -1, LIMITS.hijriOffset) }),
        inc: set(() => { face.hijriOffsetDays = stepInt(face.hijriOffsetDays, 1, LIMITS.hijriOffset) }),
      },
      {
        label: 'بداية اليوم',
        value: () => (face.hijriDayStartsAtMaghrib ? 'المغرب' : 'منتصف الليل'),
        tap: set(() => { face.hijriDayStartsAtMaghrib = !face.hijriDayStartsAtMaghrib }),
      },
    ],
  }

  // Iqama: a preset fills the minutes; each prayer can then be changed (0 = no iqama countdown).
  const presetName = () => {
    const i = iqamaPreset(face.iqama)
    return i < 0 ? 'مخصصة' : IQAMA_PRESETS[i][0]
  }
  const iqamaRow = (label, get, put) => ({
    label,
    value: () => minutes(get()),
    dec: set(() => put(stepInt(get(), -1, LIMITS.iqama))),
    inc: set(() => put(stepInt(get(), 1, LIMITS.iqama))),
  })
  const iqama = {
    title: 'الإقامة بعد الأذان',
    items: () => [
      {
        label: 'قالب',
        value: presetName,
        tap: set(() => {
          const i = iqamaPreset(face.iqama)
          face.iqama = [...IQAMA_PRESETS[(i + 1) % IQAMA_PRESETS.length][1]] // custom → the first preset
        }),
      },
      ...IQAMA_PRAYERS.map((k, i) => iqamaRow(PRAYER_NAMES_AR[k], () => face.iqama[i], (v) => { face.iqama[i] = v })),
      iqamaRow(JUMUAH_AR, () => face.iqamaJumuah, (v) => { face.iqamaJumuah = v }),
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
    title: 'أوقات إضافية',
    items: () => [
      angleRow('فجر إضافي', 'extraFajrAngle'),
      angleRow('عشاء إضافي', 'extraIshaAngle'),
      {
        label: 'نافذة الشروق',
        value: () => minutes(face.sunriseWindowMin),
        tap: set(() => { face.sunriseWindowMin = next(SUNRISE_WINDOWS, face.sunriseWindowMin) }),
      },
    ],
  }

  const adjust = {
    title: 'تعديل الأوقات (دقائق)',
    items: () => ADJUST_KEYS.map((k) => ({
      label: PRAYER_NAMES_AR[k],
      value: () => signed(face.adjust[k]),
      dec: set(() => { face.adjust[k] = stepInt(face.adjust[k], -1, LIMITS.adjust) }),
      inc: set(() => { face.adjust[k] = stepInt(face.adjust[k], 1, LIMITS.adjust) }),
    })),
  }

  const CLOCK_NAMES = { system: 'تلقائي', 12: digits('12'), 24: digits('24') }

  // First page (4 rows): what most people set once — location, method, Hijri, iqama
  return {
    title: 'الإعدادات',
    items: () => [
      { label: 'الموقع', value: ctx.place, tap: location },
      { label: 'طريقة الحساب', value: methodName, tap: () => method },
      { label: 'التاريخ الهجري', value: () => (face.hijriOffsetDays ? signed(face.hijriOffsetDays) : 'أم القرى'), tap: () => hijri },
      { label: 'الإقامة', value: presetName, tap: () => iqama },
      {
        label: 'العصر',
        value: () => (face.asrFactor === 2 ? 'الحنفي' : 'الجمهور'),
        tap: set(() => { face.asrFactor = face.asrFactor === 2 ? 1 : 2 }),
      },
      { label: 'أوقات إضافية', tap: () => extras },
      { label: 'تعديل الأوقات', tap: () => adjust },
      { label: 'نظام الساعة', value: () => CLOCK_NAMES[face.clock], tap: set(() => { face.clock = next(CLOCKS, face.clock) }) },
    ],
  }
}
