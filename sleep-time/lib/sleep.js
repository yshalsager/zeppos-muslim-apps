// Sleep-cycle maths, text and settings. Pure (no @zos imports), so Node tests run it directly.
// Times are minutes since midnight (0…1439).

const DAY = 24 * 60
const mod = (m) => ((m % DAY) + DAY) % DAY

export const MODES = ['wake', 'bed', 'now']
export const CYCLES = 6
export const BEST = [5, 6] // cycles most often recommended for adults (7.5–9 h at 90 min)

// mode 'wake': t is the wake time → bedtimes; 'bed'/'now': t is the bedtime → wake times.
// Falling asleep (fall minutes) comes before the first cycle either way. In time order.
export function results(mode, t, cycle, fall) {
  const out = []
  for (let n = 1; n <= CYCLES; n++) {
    const sleep = n * cycle
    out.push({ cycles: n, sleep, time: mode === 'wake' ? mod(t - fall - sleep) : mod(t + fall + sleep) })
  }
  return mode === 'wake' ? out.reverse() : out
}

// ±hour or ±5 minutes; minutes don't carry into the hour
export const stepHour = (t, d) => mod(t + d * 60)
export const stepMinute = (t, d) => Math.floor(t / 60) * 60 + (((Math.floor((t % 60) / 5) + d) % 12) + 12) % 12 * 5

const AR_DIGITS = '٠١٢٣٤٥٦٧٨٩'
export const digits = (s, lang) => (lang === 'ar' ? String(s).replace(/\d/g, (d) => AR_DIGITS[d]) : String(s))
const RLM = '\u200F' // keeps a string that starts with a digit right to left (guide/text-and-languages.md)
// Arabic digits, and right to left when it starts with one
export const localize = (s, lang) => (lang === 'ar' ? RLM + digits(s, lang) : s)

// '22:05' / '06:05' / '10:05 PM'; Arabic hours have no leading zero: '٦:٠٥' / '١٠:٠٥ م'
export function formatTime(t, h24, lang) {
  const h = Math.floor(t / 60)
  const mm = String(t % 60).padStart(2, '0')
  if (h24) return lang === 'ar' ? digits(`${h}:${mm}`, lang) : `${String(h).padStart(2, '0')}:${mm}`
  const pm = h >= 12
  const s = `${h % 12 || 12}:${mm} ${lang === 'ar' ? (pm ? 'م' : 'ص') : pm ? 'PM' : 'AM'}`
  return lang === 'ar' ? RLM + digits(s, lang) : s
}

// The hour as the stepper shows it, and its AM/PM mark ('' in 24-hour mode)
export const hourText = (t, h24, lang) => {
  const h = Math.floor(t / 60)
  return digits(h24 && lang !== 'ar' ? String(h).padStart(2, '0') : String(h24 ? h : h % 12 || 12), lang)
}
export const minuteText = (t, lang) => digits(String(t % 60).padStart(2, '0'), lang)
export const meridiem = (t, h24, lang) => (h24 ? '' : lang === 'ar' ? (t >= 720 ? 'مساءً' : 'صباحًا') : t >= 720 ? 'PM' : 'AM')

// '7h 30m' / '9h'; Arabic: '٧ س ٣٠ د'
export function formatDuration(m, lang) {
  const h = Math.floor(m / 60)
  const r = m % 60
  if (lang === 'ar') return localize(!h ? `${r} د` : r ? `${h} س ${r} د` : `${h} س`, lang)
  return !h ? `${r}m` : r ? `${h}h ${r}m` : `${h}h`
}

// Settings, as stored on the watch (LocalStorage, one JSON string). Anything missing or out of range
// falls back to its default, so a stale or broken value can't break the page.
export const LIMITS = { cycle: [60, 120], fall: [0, 60] }
export const CLOCKS = ['auto', '24', '12']
export const SNOOZES = [5, 9, 10, 15]
export const DEFAULTS = { cycle: 90, fall: 15, clock: 'auto', mode: 'wake', snooze: 9, wake: 7 * 60, bed: 23 * 60 }

export function parseSettings(json) {
  let raw
  try {
    raw = JSON.parse(json || '{}')
  } catch {
    raw = {}
  }
  if (!raw || typeof raw !== 'object') raw = {}
  const num = (k, lo, hi, step) => {
    const v = raw[k]
    return Number.isInteger(v) && v >= lo && v <= hi && v % step === 0 ? v : DEFAULTS[k]
  }
  return {
    cycle: num('cycle', ...LIMITS.cycle, 5),
    fall: num('fall', ...LIMITS.fall, 5),
    clock: CLOCKS.includes(raw.clock) ? raw.clock : DEFAULTS.clock,
    mode: MODES.includes(raw.mode) ? raw.mode : DEFAULTS.mode,
    snooze: SNOOZES.includes(raw.snooze) ? raw.snooze : DEFAULTS.snooze,
    wake: num('wake', 0, DAY - 5, 5),
    bed: num('bed', 0, DAY - 5, 5),
  }
}

export const is24 = (clock, watch24) => (clock === 'auto' ? watch24 : clock === '24')

// The settings page's rows: key, and the next value for a −/+ tap
export const step = {
  cycle: (v, d) => Math.min(Math.max(v + d * 5, LIMITS.cycle[0]), LIMITS.cycle[1]),
  fall: (v, d) => Math.min(Math.max(v + d * 5, LIMITS.fall[0]), LIMITS.fall[1]),
  clock: (v, d) => CLOCKS[(CLOCKS.indexOf(v) + d + CLOCKS.length) % CLOCKS.length],
  mode: (v, d) => MODES[(MODES.indexOf(v) + d + MODES.length) % MODES.length],
  snooze: (v, d) => SNOOZES[Math.min(Math.max(SNOOZES.indexOf(v) + d, 0), SNOOZES.length - 1)],
}
