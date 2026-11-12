import ui from '@zos/ui'
import { Time } from '@zos/sensor'
import { CONFIG } from '../config.js'
import { EDIT_GROUPS } from '../lib/edit-options.js'
import { readLocation } from '../lib/location.js'
import { dayEvents, nightPortions, PRAYER_ORDER, PRAYER_NAMES_AR, JUMUAH_AR } from '../lib/prayer.js'
import { countdown } from '../lib/countdown.js'
import { hijriFromEpochDay, epochDay, HIJRI_MONTHS_AR, WEEKDAYS_AR } from '../lib/hijri.js'
import { makeSensors, forecastToday, WEATHER_AR } from '../lib/extras.js'

const { createWidget, widget, align, prop, show_level } = ui
const dataType = ui.data_type || (typeof hmUI !== 'undefined' ? hmUI.data_type : {})

// Bip Max: 432 x 514, designWidth 432 => px(n) === n
const W = 432
const H = 514
const C_WHITE = 0xffffff
const C_DIM = 0x9ca3af
const C_GOLD = 0xfacc15
const C_TEAL = 0x2dd4bf
const C_RED = 0xf87171
const C_ORANGE = 0xfb923c // last minutes before an adhan / iqama
const C_NIGHT = 0xa78bfa // last third of the night
const C_TRACK = 0x262626
const C_AOD = 0x8a8a8a

const AR_DIGITS = '٠١٢٣٤٥٦٧٨٩'
const pad = (n) => (n < 10 ? '0' + n : '' + n)
const RLM = '\u200F'
// Force right-to-left layout only for text that starts with a digit (e.g. "٢ جمادى…", "٤:٤٨ - ٦:١٨").
// Don't put RLM before an Arabic letter: the watch's shaper treats it as joining, so a leading
// alef is drawn in its connected (final) form — "الخميس" got a tail on its first letter.
const ARABIC_LETTER = /^[\u0621-\u064A\u0671-\u06D3]/
const rtl = (s) => (ARABIC_LETTER.test(s) ? s : RLM + s)
const FRIDAY = 5 // Time.getDay(): Monday = 1

// Pages cycled by tapping the lower half of the face; waking the screen returns to page 0.
const PAGE_PRAYERS = 0
const PAGE_EXTRAS = 1 // night portions, Duha / Eid, extra Fajr / Isha
const PAGE_MAKRUH = 2 // prohibited windows
const PAGE_COUNT = 3
const GRID = { x: 16, y: 290, w: W - 32, h: 216 } // tap area: prayer grid + extras row
// Prayer grid: 2 rows x 3 columns, right-to-left — keep in sync with tools/render.py
const gridX = (col) => 16 + (2 - col) * 134
const CELL_W = 132
// Extras row: slot 0 is the rightmost
const COMP_Y = 442
const COMP_H = 52
const COMP_W = 120
const COMP_X = [276, 156, 36]
const ICON = 24
// Progress toward the next prayer: thin bar under the countdown line, filling right-to-left.
const BAR = { x: 116, y: 287, w: 200, h: 4 } // keep in sync with tools/render.py

const MAKRUH_ROWS = [
  ['dawn', 'من الفجر'], ['sunrise', 'الشروق'], ['zawal', 'الاستواء'], ['afterAsr', 'بعد العصر'], ['sunset', 'الغروب'],
]

let S = { ...CONFIG } // effective settings: config.js defaults + watch edit choices + location
const digits = (s) => (S.arabicDigits ? String(s).replace(/\d/g, (d) => AR_DIGITS[d]) : String(s))

function fmtClock(minOfDay) {
  const m = ((minOfDay % 1440) + 1440) % 1440
  const h = Math.floor(m / 60)
  const mm = pad(m % 60)
  return S.is24h ? pad(h) + ':' + mm : (h % 12 || 12) + ':' + mm
}
const fmtTime = (min) => (isNaN(min) ? '—' : digits(fmtClock(min)))

// Local timezone offset in hours, derived from the Time sensor so it follows the
// phone's timezone and DST without relying on QuickJS's Date timezone support.
function tzOffsetHours(time) {
  const localAsUtc = Date.UTC(time.getFullYear(), time.getMonth() - 1, time.getDate(),
    time.getHours(), time.getMinutes())
  const utc = Math.floor(time.getTime() / 60000) * 60000
  return Math.round((localAsUtc - utc) / 900000) / 4 // nearest 15 min
}

function eventsFor(ed, tz) {
  const dt = new Date(ed * 86400000)
  return dayEvents(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate(), {
    lat: S.lat, lon: S.lon, tz, method: S.method, asrFactor: 1 /* majority (Shafi'i): Asr shadow ×1, zawal 10 min */, adjust: S.adjust,
    sunriseWindowMin: S.sunriseWindowMin, extraFajrAngle: S.extraFajrAngle, extraIshaAngle: S.extraIshaAngle,
  })
}

// Long-press the face → Edit: one slot per setting. Returns { key: value } for the choices.
function buildEditGroups() {
  const chosen = {}
  for (const g of EDIT_GROUPS) {
    const [x, y, w, h] = g.rect
    const group = createWidget(widget.WATCHFACE_EDIT_GROUP, {
      edit_id: g.editId,
      x, y, w, h,
      select_image: g.select,
      un_select_image: g.unselect,
      default_type: g.defaultType,
      optional_types: g.options.map((o) => ({
        type: o.type, preview: o.preview, title_en: o.title, title_sc: o.title, title_tc: o.title,
      })),
      count: g.options.length,
      tips_BG: 'edit/tips_bg.png',
      // centred just above the slot (below it for the top slot); only the focused slot shows it
      tips_x: Math.round((w - g.tipsW) / 2),
      tips_y: y >= 60 ? -42 : h + 2,
      tips_width: g.tipsW,
      tips_margin: 8,
    })
    const type = group.getProperty(prop.CURRENT_TYPE)
    const opt = g.options.find((o) => o.type === type) || g.options.find((o) => o.type === g.defaultType)
    if (g.key === '*') Object.assign(chosen, opt.value)
    else chosen[g.key] = opt.value
  }
  return chosen
}

const IQAMA_PRAYERS = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha']
// Minutes from adhan to iqama for a prayer (0 = none), from the Iqama edit slot / config.js.
function iqamaMinutes(k, isFriday) {
  if (!S.iqama) return 0
  if (k === 'dhuhr' && isFriday) return S.iqamaJumuah || 0
  const mins = S.iqama === 'custom' ? S.iqama_custom : S.iqama
  return (mins && mins[IQAMA_PRAYERS.indexOf(k)]) || 0
}

let time = null
let state = { key: '' }
let page = PAGE_PRAYERS
let sensors = null
let w = {} // widgets

function text(opts, level = show_level.ONLY_NORMAL) {
  return createWidget(widget.TEXT, {
    align_h: align.CENTER_H, align_v: align.CENTER_V, color: C_WHITE, show_level: level, ...opts,
  })
}
// Arabic text (names, dates, labels) in the bundled Naskh font when config.js sets arabicFont;
// clock and times stay in the system font.
const arText = (opts, level) => text(CONFIG.arabicFont ? { ...opts, font: CONFIG.arabicFont } : opts, level)
const setText = (wd, s) => wd.setProperty(prop.TEXT, s)
const setColor = (wd, c) => wd.setProperty(prop.MORE, { color: c })
const show = (list, on) => list.forEach((wd) => wd.setProperty(prop.VISIBLE, on))

WatchFace({
  build() {
    time = new Time()
    S = { ...CONFIG, ...buildEditGroups(), iqama_custom: CONFIG.iqama }
    // "custom" edit options take their values from config.js
    if (S.extraFajrAngle === 'custom') S.extraFajrAngle = CONFIG.extraFajrAngle
    if (S.extraIshaAngle === 'custom') S.extraIshaAngle = CONFIG.extraIshaAngle

    this.buildNormal()
    this.buildPages()
    this.buildAod()
    this.refresh(true)

    time.onPerMinute(() => this.refresh(false))
    time.onPerDay(() => this.refresh(true))
    // Timers don't fire while the screen is off; re-sync (and re-read location) on wake.
    createWidget(widget.WIDGET_DELEGATE, {
      resume_call: () => {
        page = PAGE_PRAYERS
        this.refresh(true)
      },
    })
  },

  buildNormal() {
    createWidget(widget.FILL_RECT, { x: 0, y: 0, w: W, h: H, color: 0x000000, show_level: show_level.ONLY_NORMAL })
    w.hijri = arText({ x: 16, y: 34, w: W - 32, h: 44, text_size: 32, color: C_GOLD })
    w.time = text({ x: 0, y: 80, w: W, h: 120, text_size: 112 })
    w.greg = arText({ x: 16, y: 198, w: W - 32, h: 36, text_size: 26, color: C_DIM })
    w.next = arText({ x: 16, y: 240, w: W - 32, h: 44, text_size: 30, color: C_TEAL })
    const bar = { ...BAR, radius: 2, show_level: show_level.ONLY_NORMAL }
    w.barTrack = createWidget(widget.FILL_RECT, { ...bar, color: C_TRACK })
    w.barFill = createWidget(widget.FILL_RECT, { ...bar, color: C_TEAL })

    // Page 0 — 2 rows x 3 columns, read right-to-left: (Fajr | Sunrise | Dhuhr) (Asr | Maghrib | Isha)
    w.cells = {}
    PRAYER_ORDER.forEach((k, i) => {
      const x = gridX(i % 3)
      const y = 296 + Math.floor(i / 3) * 70
      w.cells[k] = {
        name: arText({ x, y, w: CELL_W, h: 30, text_size: 24, color: C_DIM, text: PRAYER_NAMES_AR[k] }),
        time: text({ x, y: y + 28, w: CELL_W, h: 38, text_size: 32 }),
      }
    })
    w.page0 = PRAYER_ORDER.flatMap((k) => [w.cells[k].name, w.cells[k].time])
    this.buildExtrasRow()
  },

  // Extras row under the grid (page 0 only). Each cell shows what its edit slot picked.
  buildExtrasRow() {
    const kinds = [S.comp0, S.comp1, S.comp2]
    sensors = makeSensors(kinds)
    w.comps = kinds.map((kind, slot) => {
      const x = COMP_X[slot]
      if (kind === 'weather') {
        const num = (i) => `wnum/${S.arabicDigits ? 'ar' : 'la'}_${i}.png`
        // Current temperature, drawn by the firmware; the transparent invalid image hides it
        // when the phone hasn't sent weather.
        const temp = createWidget(widget.TEXT_IMG, {
          x: x + COMP_W - 60, y: COMP_Y + 10, w: 60, h: 34,
          type: dataType.WEATHER_CURRENT,
          font_array: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(num),
          unit_en: 'wnum/deg.png', unit_sc: 'wnum/deg.png', unit_tc: 'wnum/deg.png',
          imperial_unit_en: 'wnum/deg.png', imperial_unit_sc: 'wnum/deg.png', imperial_unit_tc: 'wnum/deg.png',
          negative_image: 'wnum/minus.png', invalid_image: 'wnum/none.png',
          align_h: align.CENTER_H, h_space: 0, show_level: show_level.ONLY_NORMAL,
        })
        const cond = arText({ x, y: COMP_Y, w: COMP_W - 62, h: COMP_H, text_size: 20, color: C_DIM })
        return { kind, widgets: [temp, cond], cond }
      }
      if (kind === 'none' || !kind) return { kind: 'none', widgets: [] }
      const icon = createWidget(widget.IMG, {
        x: x + COMP_W - ICON - 4, y: COMP_Y + (COMP_H - ICON) / 2, src: `icons/${kind}.png`,
        show_level: show_level.ONLY_NORMAL,
      })
      const value = text({ x, y: COMP_Y, w: COMP_W - ICON - 8, h: COMP_H, text_size: 24 })
      return { kind, widgets: [icon, value], icon, value }
    })
    w.page0 = w.page0.concat(...w.comps.map((c) => c.widgets))
  },

  // Called every minute and on wake; weather condition only on full refreshes.
  renderExtrasRow(full) {
    for (const c of w.comps) {
      if (c.kind === 'weather') {
        if (full) {
          const f = forecastToday()
          setText(c.cond, f ? WEATHER_AR[f.index] || '' : '')
        }
        continue
      }
      if (c.kind === 'none') continue
      const v = sensors.read(c.kind)
      // Nothing to show (no heart-rate reading yet, sensor unavailable): hide icon and value.
      c.icon.setProperty(prop.VISIBLE, v !== null && page === PAGE_PRAYERS)
      // Arabic percent sign (٪) with Arabic digits, '%' with Latin digits
      setText(c.value, v === null ? '' : c.kind === 'battery' ? digits(v) + (S.arabicDigits ? '٪' : '%') : digits(v))
    }
  },

  buildPages() {
    // Page 1 — 3 rows x 3 columns (same grid as page 0), filled right-to-left
    w.extras = []
    for (let i = 0; i < 9; i++) {
      const x = gridX(i % 3)
      const y = 294 + Math.floor(i / 3) * 70
      w.extras.push({
        name: arText({ x, y, w: CELL_W, h: 28, text_size: 19, color: C_DIM }),
        time: text({ x, y: y + 26, w: CELL_W, h: 38, text_size: 30 }),
      })
    }
    w.page1 = w.extras.flatMap((c) => [c.name, c.time])

    // Page 2 — one row per prohibited window: label (right) and range (left)
    w.makruh = MAKRUH_ROWS.map(([key, label], i) => {
      const y = 296 + i * 42
      return {
        key,
        label: arText({ x: 236, y, w: 176, h: 40, text_size: 26, color: C_DIM, text: label }),
        range: text({ x: 20, y, w: 216, h: 40, text_size: 28 }),
      }
    })
    w.page2 = w.makruh.flatMap((r) => [r.label, r.range])
    show(w.page1, false)
    show(w.page2, false)

    // Transparent tap target over the grid, created last so it sits on top.
    createWidget(widget.BUTTON, {
      ...GRID, text: '', normal_src: 'tap.png', press_src: 'tap.png', show_level: show_level.ONLY_NORMAL,
      click_func: () => {
        page = (page + 1) % PAGE_COUNT
        this.refresh(false)
      },
    })
  },

  buildAod() {
    // AMOLED always-on: few lit pixels, no fills.
    const L = show_level.ONLY_AOD
    w.aodHijri = arText({ x: 16, y: 84, w: W - 32, h: 44, text_size: 30, color: C_AOD }, L)
    w.aodTime = text({ x: 0, y: 130, w: W, h: 120, text_size: 112, color: C_AOD }, L)
    w.aodGreg = arText({ x: 16, y: 248, w: W - 32, h: 36, text_size: 26, color: C_AOD }, L)
    w.aodNext = arText({ x: 16, y: 292, w: W - 32, h: 44, text_size: 30, color: C_AOD }, L)
  },

  refresh(full) {
    const y = time.getFullYear()
    const m = time.getMonth() // 1-12
    const d = time.getDate()
    const nowMin = time.getHours() * 60 + time.getMinutes()
    const key = `${y}-${m}-${d}`

    // Events for yesterday/today/tomorrow are recomputed only when the date, location or
    // timezone changes, not on every wake (settings changes rebuild the whole face).
    const loc = full || key !== state.key ? readLocation(CONFIG.lat, CONFIG.lon) : null
    const tz = loc ? tzOffsetHours(time) : state.tz
    const cacheKey = loc ? `${key}|${loc.lat}|${loc.lon}|${!!loc.updatedAt}|${tz}` : state.cacheKey
    if (cacheKey !== state.cacheKey) {
      S.lat = loc.lat
      S.lon = loc.lon
      const ed = epochDay(y, m, d)
      const today = eventsFor(ed, tz)
      const yesterday = eventsFor(ed - 1, tz)
      const civilHijri = hijriFromEpochDay(ed, S.hijriOffsetDays)
      state = {
        key, cacheKey, tz, ed, today,
        yesterdayMaghrib: yesterday.maghrib - 1440,
        yesterdayIsha: yesterday.isha - 1440,
        tomorrowFajr: eventsFor(ed + 1, tz).fajr + 1440,
        isFriday: time.getDay() === FRIDAY,
        eid: (civilHijri.month === 10 && civilHijri.day === 1) ? 'الفطر'
          : (civilHijri.month === 12 && civilHijri.day === 10) ? 'الأضحى' : null,
        fallbackLocation: !loc.updatedAt,
      }
      const name = (k) => (k === 'dhuhr' && state.isFriday ? JUMUAH_AR : PRAYER_NAMES_AR[k])
      for (const k of PRAYER_ORDER) {
        setText(w.cells[k].name, name(k))
        setText(w.cells[k].time, fmtTime(today[k]))
      }
      const wd = time.getDay() // 1..7, Monday = 1
      const fallback = state.fallbackLocation ? '  •  القاهرة' : ''
      const greg = rtl(`${WEEKDAYS_AR[wd % 7]}  ${digits(d)}/${digits(m)}/${digits(y)}${fallback}`)
      setText(w.greg, greg)
      setText(w.aodGreg, greg)
    }
    const t = state.today

    // Hijri date (optionally advancing at Maghrib)
    const afterMaghrib = S.hijriDayStartsAtMaghrib && nowMin >= t.maghrib
    const h = hijriFromEpochDay(state.ed + (afterMaghrib ? 1 : 0), S.hijriOffsetDays)
    const hijri = rtl(`${digits(h.day)} ${HIJRI_MONTHS_AR[h.month - 1]} ${digits(h.year)} هـ`)

    // Next prayer, or the current one's iqama (sunrise is shown but not counted as a prayer)
    const cd = countdown(t, nowMin, { ...state, iqama: (k) => iqamaMinutes(k, state.isFriday) })
    const next = cd.next // stays on the current prayer until its iqama
    const nameOf = (k) => (k === 'dhuhr' && state.isFriday ? JUMUAH_AR : PRAYER_NAMES_AR[k])
    const fmtLeft = (left) => (left >= 60 ? `${Math.floor(left / 60)}:${pad(left % 60)}` : `${left} د`)
    const left = digits(fmtLeft(cd.left))
    let nextStr = rtl(cd.iqama ? `إقامة ${nameOf(next)} بعد ${left}` : `${nameOf(next)} بعد ${left}`)
    if (cd.lastThird && !cd.urgent) nextStr = `الثلث الأخير  •  ${nextStr}` // overnight: time for qiyam
    // gold while waiting for iqama, orange in the last minutes before an adhan, violet in the last third of the night
    const cdColor = cd.iqama ? C_GOLD : cd.urgent ? C_ORANGE : cd.lastThird ? C_NIGHT : C_TEAL
    const clock = digits(fmtClock(nowMin))

    setText(w.hijri, hijri)
    setText(w.time, clock)
    setText(w.aodHijri, hijri)
    setText(w.aodTime, clock)
    setText(w.aodNext, nextStr)

    show(w.page0, page === PAGE_PRAYERS)
    this.renderBar(page === PAGE_PRAYERS ? cd.frac : -1, cdColor)
    this.renderExtrasRow(full)
    show(w.page1, page === PAGE_EXTRAS)
    show(w.page2, page === PAGE_MAKRUH)

    if (page === PAGE_PRAYERS) {
      setText(w.next, nextStr)
      setColor(w.next, cdColor)
      for (const k of PRAYER_ORDER) {
        const on = k === next
        setColor(w.cells[k].name, on ? C_GOLD : C_DIM)
        setColor(w.cells[k].time, on ? C_GOLD : C_WHITE)
      }
    } else if (page === PAGE_EXTRAS) {
      setText(w.next, rtl('الليل والنوافل'))
      setColor(w.next, C_DIM)
      this.renderExtras(nowMin)
    } else {
      setText(w.next, rtl('أوقات النهي'))
      setColor(w.next, C_RED)
      this.renderMakruh(nowMin)
    }
  },

  // frac < 0 hides the bar (other pages).
  renderBar(frac, color) {
    w.barTrack.setProperty(prop.VISIBLE, frac >= 0)
    const fw = Math.round(BAR.w * frac)
    w.barFill.setProperty(prop.VISIBLE, fw >= 2)
    if (fw >= 2) {
      w.barFill.setProperty(prop.MORE, { x: BAR.x + BAR.w - fw, y: BAR.y, w: fw, h: BAR.h, radius: 2, color })
    }
  },

  renderExtras(nowMin) {
    const t = state.today
    // Before today's Fajr we're still in last night (yesterday's Maghrib → today's Fajr).
    const night = nowMin < t.fajr ? nightPortions(state.yesterdayMaghrib, t.fajr) : nightPortions(t.maghrib, state.tomorrowFajr)
    const items = []
    if (night) {
      items.push(['الثلث الأول', night.firstThird], ['منتصف الليل', night.midpoint],
        ['الثلث الأخير', night.lastThird], ['السدس الأخير', night.lastSixth])
    }
    if (state.eid) {
      items.push([`صلاة عيد ${state.eid}`, t.eidStart], ['نهاية وقت العيد', t.eidEnd])
    } else {
      items.push(['الضحى', t.duha])
    }
    // NaN when off or equal to the method's own angle (e.g. 12° under UIOF)
    if (!isNaN(t.extraFajr)) items.push([`الفجر (${digits(S.extraFajrAngle)}°)`, t.extraFajr])
    if (!isNaN(t.extraIsha)) items.push([`العشاء (${digits(S.extraIshaAngle)}°)`, t.extraIsha])

    // Gold = the soonest item still ahead (night portions are in minutes from today's midnight,
    // so tonight's are > 1440 and last night's are < 0 — plain comparison works).
    let upcoming = -1
    items.forEach(([, v], i) => {
      if (v > nowMin && (upcoming < 0 || v < items[upcoming][1])) upcoming = i
    })
    w.extras.forEach((c, i) => {
      const item = items[i]
      setText(c.name, item ? item[0] : '')
      setText(c.time, item ? fmtTime(item[1]) : '')
      setColor(c.name, i === upcoming ? C_GOLD : C_DIM)
      setColor(c.time, i === upcoming ? C_GOLD : C_WHITE)
    })
  },

  renderMakruh(nowMin) {
    const windows = state.today.makruh
    for (const r of w.makruh) {
      const [a, b] = windows[r.key]
      const active = nowMin >= a && nowMin < b
      setText(r.range, rtl(`${fmtTime(a)} - ${fmtTime(b)}`)) // RTL: start time on the right
      setColor(r.label, active ? C_RED : C_DIM)
      setColor(r.range, active ? C_RED : C_WHITE)
    }
  },

  onDestroy() {
    time = null
    w = {}
  },
})
