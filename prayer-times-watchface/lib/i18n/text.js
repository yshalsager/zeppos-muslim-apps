// Face lines built from a language's strings (lib/i18n/<lang>.js). Shared by watchface/index.js
// and the docs/preview generators (tools/*.mjs), so screenshots show the face's own text.
// digits(s): the face's digit style (Arabic-Indic or Latin) applied to a string.
import { LANGS, DEFAULT_LANG } from './index.js'

export const strings = (lang) => LANGS[lang] || LANGS[DEFAULT_LANG]

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

// weekday: 0 = Sunday; month 1-12
export const gregLine = (T, { weekday, d, m, y }, digits, place) =>
  line(T, T.date({ wd: T.weekdays[weekday], d: digits(d), mon: T.months[m - 1], m: digits(m), y: digits(y) }) +
    (place ? `  •  ${place}` : ''))

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
