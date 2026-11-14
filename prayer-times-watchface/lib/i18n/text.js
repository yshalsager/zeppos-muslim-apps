// Face lines built from a language's strings (T: lib/i18n/load.js on the watch, tables.js in Node).
// Shared by watchface/index.js and the docs/preview generators (tools/*.mjs), so screenshots show the face's own text.
// digits(s): the face's digit style (Arabic-Indic or Latin) applied to a string.
import { TEXT_WIDTH } from '../text-width.js'

const RLM = '‏'
// Right-to-left languages: force right-to-left layout only for text that starts with a digit
// (e.g. "٢ جمادى…", "٤:٤٨ - ٦:١٨"). Don't put RLM before an Arabic letter: the watch's shaper treats
// it as joining, so a leading alef is drawn in its connected (final) form — "الخميس" got a tail on
// its first letter. Left-to-right languages: as is.
const ARABIC_LETTER = /^[ء-يٱ-ۓ]/
export const line = (T, s) => (!T.rtl || ARABIC_LETTER.test(s) ? s : RLM + s)

const pad = (n) => (n < 10 ? '0' + n : '' + n)

// h: { day, month, year } (lib/hijri.js)
export const hijriLine = (T, h, digits) =>
  line(T, T.hijriDate({ d: digits(h.day), mon: T.hijriMonths[h.month - 1], m: digits(h.month), y: digits(h.year) }))

// Estimated width of s in px at the font's TEXT_WIDTH size (lib/text-width.js, generated)
const estimate = (font, s) => {
  let w = 0
  for (const c of s) w += font.w[c] || font.other
  return w
}

// s cut with "…" until the estimate fits room (px at TEXT_WIDTH.size); s itself when it fits.
// font.cut: extra room a cut needs (an Arabic letter before "…" takes its wider final form).
export function fitText(font, s, room) {
  if (estimate(font, s) <= room) return s
  const ellipsis = estimate(font, '…') + font.cut
  let n = s.length
  while (n > 1 && estimate(font, s.slice(0, n)) + ellipsis > room) n--
  return s.slice(0, n).trimEnd() + '…'
}

// s shortened with "…" to fit box ({ w, text_size }, a lib/layout.js text box), in T's font
export function fitBox(T, s, box) {
  return fitText(TEXT_WIDTH[T.rtl ? 'naskh' : 'system'], s, box.w * TEXT_WIDTH.size / box.text_size)
}

// The date line: "Thu 12 Nov 2026", or with a place "Thu 12 Nov  •  Cairo" (no year: the Hijri line
// above has one, and the place needs the room). place: a string, or candidates longest first (e.g.
// coordinates to 0.1°, then to 1°): the first that fits is used. box ({ w, text_size }, the date
// line's lib/layout.js box) shortens the last candidate to fit; without it the first is kept whole.
// weekday: 0 = Sunday; month 1-12
export function gregLine(T, { weekday, d, m, y }, digits, place, box) {
  const p = { wd: T.weekdays[weekday], d: digits(d), mon: T.months[m - 1], m: digits(m), y: digits(y) }
  const places = Array.isArray(place) ? place : [place]
  if (!places[0]) return line(T, T.date(p))
  const date = `${T.dateShort(p)}  •  `
  if (!box) return line(T, date + places[0])
  const font = TEXT_WIDTH[T.rtl ? 'naskh' : 'system']
  const room = box.w * TEXT_WIDTH.size / box.text_size - estimate(font, date)
  const fits = places.find((s) => estimate(font, s) <= room)
  return line(T, date + (fits || fitText(font, places[places.length - 1], room)))
}

// Prayer name, Jumu'ah for Dhuhr on Fridays
export const prayerName = (T, k, isFriday) => (k === 'dhuhr' && isFriday ? T.jumuah : T.prayers[k])

// The countdown line for lib/countdown.js's result
export function nextLine(T, cd, isFriday, digits) {
  const left = cd.left >= 60 ? digits(`${Math.floor(cd.left / 60)}:${pad(cd.left % 60)}`) : T.minutes(digits(cd.left))
  const name = prayerName(T, cd.next, isFriday)
  const s = line(T, cd.iqama ? T.iqamaIn(name, left) : T.nextIn(name, left))
  return cd.lastThird && !cd.urgent ? `${T.lastThird}  •  ${s}` : s // overnight: time for qiyam
}

// Page 1 items before the times: [[label, minutes]]. night: lib/prayer.js nightPortions() or null;
// t: today's events; eid: 'fitr' | 'adha' | null; angles: { fajr, isha } for the extra times.
export function extraItems(T, night, t, eid, angles, digits) {
  const items = []
  if (night) {
    items.push([T.night.firstThird, night.firstThird], [T.night.midpoint, night.midpoint],
      [T.night.lastThird, night.lastThird], [T.night.lastSixth, night.lastSixth])
  }
  if (eid) items.push([T.eid[eid], t.eidStart], [T.eidEnd, t.eidEnd])
  else items.push([T.duha, t.duha])
  // NaN when off or equal to the method's own angle (e.g. 12° under UIOF)
  if (!isNaN(t.extraFajr)) items.push([`${T.prayers.fajr} (${digits(angles.fajr)}°)`, t.extraFajr])
  if (!isNaN(t.extraIsha)) items.push([`${T.prayers.isha} (${digits(angles.isha)}°)`, t.extraIsha])
  return items
}

export const MAKRUH_KEYS = ['dawn', 'sunrise', 'zawal', 'afterAsr', 'sunset']
// "start - end", the start first in reading order
export const rangeLine = (T, a, b) => line(T, `${a} - ${b}`)
