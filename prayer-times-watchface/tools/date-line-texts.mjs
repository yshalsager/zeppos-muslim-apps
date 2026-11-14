// Prints, as JSON, every string that can appear on the face's date line, grouped by the font that
// draws it: { naskh: [...], system: [...] } (Arabic uses the bundled Naskh font, the other languages
// the system font). tools/gen-text-width.py measures them for lib/text-width.js.
// With --lines: the face's date line (lib/i18n/text.js gregLine) for every city, on each language's
// three widest dates, as { box, lines: { lang: [...] } }, for gen-text-width.py to check they fit.
// Run: node tools/date-line-texts.mjs [--lines]
import { readFileSync, readdirSync } from 'node:fs'
import { LANG_CODES } from '../lib/i18n/index.js'
import { LANGS } from '../lib/i18n/tables.js'

const DEVICES = JSON.parse(readFileSync(new URL('../devices.json', import.meta.url), 'utf8'))
const target = Object.keys(DEVICES).find((k) => !k.startsWith('/'))
const dir = new URL(`../assets/${target}/cities/`, import.meta.url)
const rows = []
for (const f of readdirSync(dir)) {
  if (f === 'index.json') continue
  const d = JSON.parse(readFileSync(new URL(f, dir), 'utf8'))
  if (d.cities) rows.push(...d.cities)
  else for (const r of d.regions) rows.push(...r[1])
}

const AR_DIGITS = '٠١٢٣٤٥٦٧٨٩'

if (process.argv[2] === '--lines') {
  const { gregLine } = await import('../lib/i18n/text.js')
  const { TEXT_WIDTH } = await import('../lib/text-width.js')
  const { layout } = await import('../lib/layout.js')
  const box = layout().greg
  const lines = {}
  for (const lang of LANG_CODES) {
    const T = LANGS[lang]
    const font = TEXT_WIDTH[T.rtl ? 'naskh' : 'system']
    const est = (s) => [...s].reduce((w, c) => w + (font.w[c] || font.other), 0)
    lines[lang] = []
    for (const arabic of [true, false]) {
      const digits = (s) => (arabic ? String(s).replace(/\d/g, (c) => AR_DIGITS[c]) : String(s))
      const dates = []
      for (let weekday = 0; weekday < 7; weekday++) {
        for (let m = 1; m <= 12; m++) {
          const p = { wd: T.weekdays[weekday], d: digits(28), mon: T.months[m - 1], m: digits(m) }
          dates.push({ weekday, d: 28, m, y: 2026, w: est(T.dateShort(p)) })
        }
      }
      dates.sort((a, b) => b.w - a.w)
      const places = [T.fallbackPlace, T.coords(digits('-33.9'), digits('151.2')), ...rows.map((r) => (T.rtl ? r[0] : r[3] || r[0]))]
      for (const date of dates.slice(0, 3)) for (const place of places) lines[lang].push(gregLine(T, date, digits, place, box))
    }
  }
  // exit once the (large) output is flushed: process.exit() right away truncates a pipe
  process.stdout.write(JSON.stringify({ box, lines }) + '\n', () => process.exit(0))
  await new Promise(() => {})
}

const out = { naskh: new Set(), system: new Set() }
for (const lang of LANG_CODES) {
  const T = LANGS[lang]
  const set = T.rtl ? out.naskh : out.system
  for (const arabic of [true, false]) {
    const digits = (s) => (arabic ? String(s).replace(/\d/g, (c) => AR_DIGITS[c]) : String(s))
    for (let wd = 0; wd < 7; wd++) {
      for (let m = 1; m <= 12; m++) {
        const p = { wd: T.weekdays[wd], d: digits(28), mon: T.months[m - 1], m: digits(m), y: digits(2026) }
        set.add(`${T.date(p)}  •  `)
        set.add(`${T.dateShort(p)}  •  `)
      }
    }
    set.add(T.coords(digits('-33.9'), digits('151.2')))
    set.add('…')
  }
  set.add(T.fallbackPlace)
  for (const r of rows) set.add(T.rtl ? r[0] : r[3] || r[0])
}
console.log(JSON.stringify({ naskh: [...out.naskh], system: [...out.system] }))
