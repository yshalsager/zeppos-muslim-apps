import ui from '@zos/ui'
import { Time } from '@zos/sensor'
import { getScene, SCENE_AOD } from '@zos/app'
import { getTimeFormat, TIME_FORMAT_24, getLanguage } from '@zos/settings'
import { launchApp, SYSTEM_APP_WEATHER, SYSTEM_APP_STATUS, SYSTEM_APP_HR } from '@zos/router'
import { CONFIG } from '../config.js'
import { EDIT_GROUPS } from '../lib/edit-options.js'
import { readLocation, saveCity } from '../lib/location.js'
import { readJSON, writeJSON } from '../lib/store.js'
import { SETTINGS_KEY, sanitizeSettings, effectiveSettings, resolveMethod } from '../lib/settings.js'
import { autoMethod } from '../lib/methods.js'
import { createMenu } from './menu.js'
import { rootScreen } from './screens.js'
import { dayEvents, nightPortions, PRAYER_ORDER } from '../lib/prayer.js'
import { countdown } from '../lib/countdown.js'
import { hijriFromEpochDay, epochDay } from '../lib/hijri.js'
import { makeSensors } from '../lib/extras.js'
import { WEATHER_ICONS } from '../lib/weather-icons.js'
import { resolveLang } from '../lib/i18n/index.js'
import {
  strings, line, hijriLine, gregLine, prayerName, nextLine, extraItems, rangeLine, MAKRUH_KEYS,
} from '../lib/i18n/text.js'

const { createWidget, deleteWidget, widget, align, prop, show_level, event } = ui
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
const FRIDAY = 5 // Time.getDay(): Monday = 1

// Language (lib/i18n): T holds its strings. Layout below is written for right-to-left (Arabic);
// box() mirrors a rectangle for left-to-right languages, so reading order matches the language.
let lang = ''
let T = strings('ar')
const watchLanguage = () => {
  try {
    return getLanguage()
  } catch (e) {
    return undefined
  }
}
const box = (r) => (T.rtl ? r : { ...r, x: W - r.x - r.w })

// Pages cycled by tapping the lower half of the face; waking the screen returns to page 0.
const PAGE_PRAYERS = 0
const PAGE_EXTRAS = 1 // night portions, Duha / Eid, extra Fajr / Isha
const PAGE_MAKRUH = 2 // prohibited windows
const PAGE_COUNT = 3
const GRID = { x: 16, y: 290, w: W - 32, h: 216 } // tap area: prayer grid + extras row
const DATE_TAP = { x: 16, y: 194, w: W - 32, h: 44 } // tap area: Gregorian date line → settings menu
// Prayer grid: 2 rows x 3 columns, right-to-left (mirrored by box()) — keep in sync with tools/render.py
const gridX = (col) => 16 + (2 - col) * 134
const CELL_W = 132
// Extras row: slot 0 is the rightmost (leftmost when mirrored)
const COMP_Y = 442
const COMP_H = 52
const COMP_W = 120
const COMP_X = [276, 156, 36]
const ICON = 24
// Progress toward the next prayer: thin bar under the countdown line, filling in reading direction.
const BAR = { x: 116, y: 287, w: 200, h: 4 } // keep in sync with tools/render.py
const GEAR = { x: 20, y: 204, w: 24, h: 24 } // at the end of the date line

let S = { ...CONFIG } // effective settings (lib/settings.js effectiveSettings) + location
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

// opts overrides S (the menu previews a method before it's applied)
function eventsFor(ed, tz, opts) {
  const o = { ...S, ...opts }
  const dt = new Date(ed * 86400000)
  return dayEvents(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate(), {
    lat: o.lat, lon: o.lon, tz, method: o.method, asrFactor: o.asrFactor, adjust: o.adjust,
    sunriseWindowMin: o.sunriseWindowMin, extraFajrAngle: o.extraFajrAngle, extraIshaAngle: o.extraIshaAngle,
  })
}

const system24h = () => {
  try {
    return getTimeFormat() === TIME_FORMAT_24
  } catch (e) {
    return false
  }
}

// Hijri date for a day (optionally advancing at Maghrib), with the given settings
function hijriText(ed, nowMin, maghrib, set) {
  const afterMaghrib = set.hijriDayStartsAtMaghrib && nowMin >= maghrib
  return hijriLine(T, hijriFromEpochDay(ed + (afterMaghrib ? 1 : 0), set.hijriOffsetDays), digits)
}

// Long-press the face → Edit: one slot per look (digits, extras row). Returns { key: value }.
// Built once per face load, so slots and previews follow the language the face was loaded with.
function buildEditGroups() {
  const chosen = {}
  const dir = T.rtl ? 'rtl' : 'ltr'
  for (const g of EDIT_GROUPS) {
    const [rx, y, w, h] = g.rect
    const { x } = box({ x: rx, w })
    const defaultType = g.defaultType[dir]
    const group = createWidget(widget.WATCHFACE_EDIT_GROUP, {
      edit_id: g.editId,
      x, y, w, h,
      select_image: g.select,
      un_select_image: g.unselect,
      default_type: defaultType,
      optional_types: g.options.map((o) => {
        const title = T.edit[o.label]
        return { type: o.type, preview: o.preview[dir], title_en: title, title_sc: title, title_tc: title }
      }),
      count: g.options.length,
      tips_BG: 'edit/tips_bg.png',
      // centred just above the slot (below it for the top slot); only the focused slot shows it
      tips_x: Math.round((w - g.tipsW) / 2),
      tips_y: y >= 60 ? -42 : h + 2,
      tips_width: g.tipsW,
      tips_margin: 8,
    })
    const type = group.getProperty(prop.CURRENT_TYPE)
    const opt = g.options.find((o) => o.type === type) || g.options.find((o) => o.type === defaultType)
    chosen[g.key] = opt.value
  }
  return chosen
}

const IQAMA_PRAYERS = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha']
// Minutes from adhan to iqama for a prayer (0 = none), from the face menu.
function iqamaMinutes(k, isFriday) {
  if (k === 'dhuhr' && isFriday) return S.iqamaJumuah || 0
  return S.iqama[IQAMA_PRAYERS.indexOf(k)] || 0
}

let time = null
let state = { key: '' }
let page = PAGE_PRAYERS
let sensors = null
let w = {} // widgets
let made = [] // every widget built by make(): deleted when the language changes the layout
let face = null // face-menu settings (lib/settings.js), saved in the face's storage
let edit = null // Edit-slot choices
let menu = null // settings menu (watchface/menu.js)
let settingsChanged = false

const make = (type, opts) => {
  const wd = createWidget(type, opts)
  made.push(wd)
  return wd
}
function text(opts, level = show_level.ONLY_NORMAL) {
  return make(widget.TEXT, {
    align_h: align.CENTER_H, align_v: align.CENTER_V, color: C_WHITE, show_level: level, ...opts,
  })
}
// Words (names, dates, labels): for Arabic, the bundled Naskh font when config.js sets arabicFont;
// other languages, the clock and the times use the system font.
const arText = (opts, level) => text(T.rtl && CONFIG.arabicFont ? { ...opts, font: CONFIG.arabicFont } : opts, level)
// Write-only-on-change: refresh() runs every minute (also on the always-on screen) and on every
// wake, and most values don't change. Every text/colour/visibility write must go through these
// three, or the remembered value goes stale.
const last = new Map() // widget → { t: text, c: colour, v: visible }
const memo = (wd) => {
  let m = last.get(wd)
  if (!m) last.set(wd, (m = {}))
  return m
}
const setText = (wd, s) => {
  const m = memo(wd)
  if (m.t !== s) { m.t = s; wd.setProperty(prop.TEXT, s) }
}
// Invisible tap area: an alpha-0 FILL_RECT with listeners, so no image is needed. Only a quick,
// still tap counts: a long press (face picker) or a swipe that starts here stays the system's.
// Widgets created later sit on top and take the taps, so tap areas are created last.
// onPress(true/false) runs on touch down / up (the menu highlights the pressed row).
const TAP_MAX_MS = 600
const TAP_MAX_MOVE = 24 // px
const tap = (area, onTap, onPress) => {
  const wd = make(widget.FILL_RECT, { ...area, color: 0x000000, alpha: 0, show_level: show_level.ONLY_NORMAL })
  let down = null
  wd.addEventListener(event.CLICK_DOWN, (e) => {
    down = { t: Date.now(), x: e && e.x, y: e && e.y }
    if (onPress) onPress(true)
  })
  wd.addEventListener(event.CLICK_UP, (e) => {
    const d = down
    down = null
    if (onPress) onPress(false)
    if (d && Date.now() - d.t > TAP_MAX_MS) return
    if (d && e && typeof d.x === 'number' && typeof e.x === 'number' &&
      Math.abs(e.x - d.x) + Math.abs(e.y - d.y) > TAP_MAX_MOVE) return
    onTap()
  })
  return wd
}
// Extras cells that open a system app (API 3.0 constants; a cell without one cycles pages)
const COMP_APPS = { weather: SYSTEM_APP_WEATHER, steps: SYSTEM_APP_STATUS, flame: SYSTEM_APP_STATUS, heart: SYSTEM_APP_HR }
const openApp = (appId) => {
  try {
    launchApp({ appId, native: true })
  } catch (e) {
    console.log('launchApp failed: ' + e)
  }
}
const setColor = (wd, c) => {
  const m = memo(wd)
  if (m.c !== c) { m.c = c; wd.setProperty(prop.MORE, { color: c }) }
}
const show = (list, on) => list.forEach((wd) => {
  const m = memo(wd)
  if (m.v !== on) { m.v = on; wd.setProperty(prop.VISIBLE, on) }
})
// The always-on screen runs its own instance of the face (Zepp's watchface samples branch on
// getScene() in build()); that instance only needs the always-on texts.
const scene = () => (typeof getScene === 'function' ? getScene() : -1)
const isAodScene = () => scene() === SCENE_AOD

WatchFace({
  build() {
    time = new Time()
    face = sanitizeSettings(readJSON(SETTINGS_KEY, null), CONFIG)
    this.pickLanguage()
    edit = buildEditGroups() // also in the always-on instance: it reads the chosen settings
    S = this.settingsFor({ lat: CONFIG.lat, lon: CONFIG.lon, cc: CONFIG.country }) // refresh() re-reads the location

    // The normal instance still builds the always-on texts, in case the firmware reuses it.
    if (!isAodScene()) {
      this.buildNormal()
      this.buildTaps()
    }
    this.buildAod()
    this.refresh(true)

    time.onPerMinute(() => this.refresh(false))
    time.onPerDay(() => this.refresh(true))
    // Timers don't fire while the screen is off; re-sync (and re-read location) on wake.
    createWidget(widget.WIDGET_DELEGATE, {
      resume_call: () => {
        if (menu) menu.close()
        page = PAGE_PRAYERS
        if (!isAodScene() && this.pickLanguage()) this.relayout() // 'auto' and the watch's language changed
        else this.refresh(true)
      },
    })
  },

  // Sets T from the face setting and the watch's language; true if the language changed.
  pickLanguage() {
    const next = resolveLang(face.language, face.language === 'auto' ? watchLanguage() : undefined)
    if (next === lang) return false
    lang = next
    T = strings(lang)
    return true
  },

  // Rebuilds the face's widgets for a new language (direction, font and texts). Edit slots stay as
  // built until the face reloads. Deferred: it can be reached from a tap handler of a widget it deletes.
  relayout() {
    const run = () => {
      for (const wd of made) {
        try { deleteWidget(wd) } catch (e) { console.log('deleteWidget failed: ' + e) }
      }
      made = []
      last.clear()
      w = {}
      menu = null
      this.menuRoot = null
      page = PAGE_PRAYERS
      state = { key: '' }
      this.buildNormal()
      this.buildTaps()
      this.buildAod()
      this.refresh(true)
    }
    if (typeof setTimeout === 'function') setTimeout(run, 0)
    else run()
  },

  buildNormal() {
    make(widget.FILL_RECT, { x: 0, y: 0, w: W, h: H, color: 0x000000, show_level: show_level.ONLY_NORMAL })
    w.hijri = arText({ x: 16, y: 34, w: W - 32, h: 44, text_size: 32, color: C_GOLD })
    w.time = text({ x: 0, y: 80, w: W, h: 120, text_size: 112 })
    w.greg = arText({ x: 48, y: 198, w: W - 96, h: 36, text_size: 26, color: C_DIM })
    // ⚙ at the end of the date line: tapping the line opens the settings menu
    make(widget.IMG, { ...box(GEAR), src: 'icons/gear.png', show_level: show_level.ONLY_NORMAL })
    w.next = arText({ x: 16, y: 240, w: W - 32, h: 44, text_size: 30, color: C_TEAL })
    const bar = { ...BAR, radius: 2, show_level: show_level.ONLY_NORMAL }
    w.barTrack = make(widget.FILL_RECT, { ...bar, color: C_TRACK })
    w.barFill = make(widget.FILL_RECT, { ...bar, color: C_TEAL })

    // Page 0 — 2 rows x 3 columns in reading order: (Fajr | Sunrise | Dhuhr) (Asr | Maghrib | Isha)
    w.cells = {}
    PRAYER_ORDER.forEach((k, i) => {
      const x = gridX(i % 3)
      const y = 296 + Math.floor(i / 3) * 70
      w.cells[k] = {
        name: arText({ ...box({ x, y, w: CELL_W, h: 30 }), text_size: 24, color: C_DIM, text: T.prayers[k] }),
        time: text({ ...box({ x, y: y + 28, w: CELL_W, h: 38 }), text_size: 32 }),
      }
    })
    w.gridCells = PRAYER_ORDER.flatMap((k) => [w.cells[k].name, w.cells[k].time])
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
        // Current condition and temperature, both drawn by the firmware from the phone's weather.
        // Unknown weather (code 25) has a transparent icon, and the transparent invalid image
        // hides the temperature when the phone hasn't sent any.
        const icon = make(widget.IMG_LEVEL, {
          ...box({ x: x + COMP_W - ICON - 4, y: COMP_Y + (COMP_H - ICON) / 2, w: ICON, h: ICON }),
          image_array: WEATHER_ICONS, image_length: WEATHER_ICONS.length,
          type: dataType.WEATHER, show_level: show_level.ONLY_NORMAL,
        })
        const temp = make(widget.TEXT_IMG, {
          ...box({ x, y: COMP_Y + 10, w: COMP_W - ICON - 8, h: 34 }),
          type: dataType.WEATHER_CURRENT,
          font_array: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(num),
          unit_en: 'wnum/deg.png', unit_sc: 'wnum/deg.png', unit_tc: 'wnum/deg.png',
          imperial_unit_en: 'wnum/deg.png', imperial_unit_sc: 'wnum/deg.png', imperial_unit_tc: 'wnum/deg.png',
          negative_image: 'wnum/minus.png', invalid_image: 'wnum/none.png',
          align_h: align.CENTER_H, h_space: 0, show_level: show_level.ONLY_NORMAL,
        })
        return { kind, widgets: [icon, temp] }
      }
      if (kind === 'none' || !kind) return { kind: 'none', widgets: [] }
      const icon = make(widget.IMG, {
        ...box({ x: x + COMP_W - ICON - 4, y: COMP_Y + (COMP_H - ICON) / 2, w: ICON, h: ICON }), src: `icons/${kind}.png`,
        show_level: show_level.ONLY_NORMAL,
      })
      const value = text({ ...box({ x, y: COMP_Y, w: COMP_W - ICON - 8, h: COMP_H }), text_size: 24 })
      return { kind, widgets: [icon, value], icon, value }
    })
    w.compWidgets = [].concat(...w.comps.map((c) => c.widgets))
  },

  // Called every minute and on wake. Weather is drawn by the firmware.
  renderExtrasRow() {
    for (const c of w.comps) {
      if (c.kind === 'weather' || c.kind === 'none') continue
      const v = sensors.read(c.kind)
      // Nothing to show (no heart-rate reading yet, sensor unavailable): hide icon and value.
      show([c.icon], v !== null && page === PAGE_PRAYERS)
      // Arabic percent sign (٪) with Arabic digits, '%' with Latin digits
      setText(c.value, v === null ? '' : c.kind === 'battery' ? digits(v) + (S.arabicDigits ? '٪' : '%') : digits(v))
    }
  },

  // Pages 1 and 2, built on the first tap away from page 0 (most face loads never leave it).
  buildPages() {
    if (w.page1) return
    // Page 1 — 3 rows x 3 columns (same grid as page 0), in reading order
    w.extras = []
    for (let i = 0; i < 9; i++) {
      const x = gridX(i % 3)
      const y = 294 + Math.floor(i / 3) * 70
      w.extras.push({
        name: arText({ ...box({ x, y, w: CELL_W, h: 28 }), text_size: 19, color: C_DIM }),
        time: text({ ...box({ x, y: y + 26, w: CELL_W, h: 38 }), text_size: 30 }),
      })
    }
    w.page1 = w.extras.flatMap((c) => [c.name, c.time])

    // Page 2 — one row per prohibited window: label first in reading order, then the range
    w.makruh = MAKRUH_KEYS.map((key, i) => {
      const y = 296 + i * 42
      return {
        key,
        label: arText({ ...box({ x: 236, y, w: 176, h: 40 }), text_size: 26, color: C_DIM, text: T.makruh[key] }),
        range: text({ ...box({ x: 20, y, w: 216, h: 40 }), text_size: 28 }),
      }
    })
    w.page2 = w.makruh.flatMap((r) => [r.label, r.range])
    show(w.page1, false)
    show(w.page2, false)
    this.lowerTaps() // the pages now sit on top of the lower half's tap areas
  },

  // Tap areas over the lower half: the grid (cycles pages) and, on page 0, the extras cells that
  // open an app (above the grid's). Called again after buildPages() to put fresh ones on top; the
  // old ones are hidden, not deleted, since that runs inside the grid's own tap handler.
  lowerTaps() {
    if (w.gridTap) show([w.gridTap, ...w.compTaps], false)
    w.gridTap = tap(GRID, () => {
      page = (page + 1) % PAGE_COUNT
      this.buildPages()
      this.refresh(false)
    })
    w.compTaps = []
    w.comps.forEach((c, slot) => {
      const appId = COMP_APPS[c.kind]
      if (typeof appId !== 'number') return
      w.compTaps.push(tap(box({ x: COMP_X[slot], y: COMP_Y, w: COMP_W, h: COMP_H }), () => openApp(appId)))
    })
  },

  // Tap areas last, so they sit on top.
  buildTaps() {
    this.lowerTaps()
    w.dateTap = tap(DATE_TAP, () => this.openMenu())
  },

  // Settings menu over the face (tap the date line); see watchface/menu.js and screens.js.
  // Created on the first tap, not in build(): most face loads never open it.
  buildMenu() {
    const h = {
      create: make, text, arText, tap, show, setText, setColor, digits, box, rtl: T.rtl, W, H,
      colors: { title: C_GOLD, text: C_WHITE, dim: C_DIM, accent: C_TEAL },
    }
    menu = createMenu(h, () => this.onMenuClosed())
    const nowMin = () => time.getHours() * 60 + time.getMinutes()
    this.menuRoot = rootScreen({
      face,
      T,
      lang,
      watchLang: () => resolveLang('auto', watchLanguage()),
      digits,
      accent: C_TEAL,
      place: () => state.place || T.fromApp,
      message: (s) => menu.message(s),
      close: () => menu.close(),
      changed: () => { settingsChanged = true },
      // Live previews from the settings being edited (applied when the menu closes)
      autoMethod: () => autoMethod(state.cc),
      hijri: () => hijriText(state.ed, nowMin(), state.today.maghrib, face),
      times: () => {
        const e = eventsFor(state.ed, state.tz, { ...face, method: resolveMethod(face, state.cc) })
        return { fajr: fmtTime(e.fajr), asr: fmtTime(e.asr), isha: fmtTime(e.isha) }
      },
      setCity: (name, lat, lon, cc) => {
        if (!saveCity(name, lat, lon, cc)) return menu.message(T.menu.cantSave)
        state.cacheKey = '' // location changed: recompute
        menu.close()
      },
    })
  },

  openMenu() {
    if (!menu) this.buildMenu()
    // Back to page 0 first: pages built after the menu would draw over its background.
    if (page !== PAGE_PRAYERS) {
      page = PAGE_PRAYERS
      this.refresh(false)
    }
    show([w.gridTap, w.dateTap, ...w.compTaps], false)
    menu.open(this.menuRoot)
  },

  onMenuClosed() {
    show([w.gridTap, w.dateTap], true)
    if (settingsChanged) {
      settingsChanged = false
      if (!writeJSON(SETTINGS_KEY, face)) console.log('settings not saved')
      state.cacheKey = '' // times, iqama and 12/24h all depend on the settings: recompute
      if (this.pickLanguage()) return this.relayout()
    }
    this.refresh(true) // re-reads the location and re-resolves the settings
  },

  // loc: { lat, lon, cc } → effective settings for it
  settingsFor(loc) {
    return { ...effectiveSettings(CONFIG, face, edit, { cc: loc.cc, system24h: system24h() }), lat: loc.lat, lon: loc.lon }
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

    // Events for yesterday/today/tomorrow are recomputed only when the date, location, timezone,
    // method (automatic follows the country) or the watch's 12/24h setting changes, not on every
    // wake. Edit-slot changes rebuild the whole face; face-menu changes clear state.cacheKey.
    const loc = full || key !== state.key ? readLocation(CONFIG) : null
    if (loc) S = this.settingsFor(loc)
    const tz = loc ? tzOffsetHours(time) : state.tz
    const cacheKey = loc ? `${key}|${loc.lat}|${loc.lon}|${loc.source}|${loc.name}|${tz}|${S.method}|${S.is24h}` : state.cacheKey
    if (cacheKey !== state.cacheKey) {
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
        eid: (civilHijri.month === 10 && civilHijri.day === 1) ? 'fitr'
          : (civilHijri.month === 12 && civilHijri.day === 10) ? 'adha' : null,
        place: loc.source === 'fallback' ? T.fallbackPlace
          : loc.source === 'city' ? (!T.rtl && loc.latin) || loc.name : '',
        cc: loc.cc,
      }
      const greg = gregLine(T, { weekday: time.getDay() % 7, d, m, y }, digits, state.place) // getDay(): Monday = 1
      setText(w.aodGreg, greg)
      if (w.time) {
        for (const k of PRAYER_ORDER) {
          setText(w.cells[k].name, prayerName(T, k, state.isFriday))
          setText(w.cells[k].time, fmtTime(today[k]))
        }
        setText(w.greg, greg)
      }
    }
    const t = state.today

    const hijri = hijriText(state.ed, nowMin, t.maghrib, S)

    // Next prayer, or the current one's iqama (sunrise is shown but not counted as a prayer)
    const cd = countdown(t, nowMin, { ...state, iqama: (k) => iqamaMinutes(k, state.isFriday) })
    const next = cd.next // stays on the current prayer until its iqama
    const nextStr = nextLine(T, cd, state.isFriday, digits)
    // gold while waiting for iqama, orange in the last minutes before an adhan, violet in the last third of the night
    const cdColor = cd.iqama ? C_GOLD : cd.urgent ? C_ORANGE : cd.lastThird ? C_NIGHT : C_TEAL
    const clock = digits(fmtClock(nowMin))

    setText(w.aodHijri, hijri)
    setText(w.aodTime, clock)
    setText(w.aodNext, nextStr)
    if (!w.time) return // always-on instance: nothing else exists

    setText(w.hijri, hijri)
    setText(w.time, clock)

    show(w.gridCells, page === PAGE_PRAYERS)
    show(w.compWidgets, page === PAGE_PRAYERS)
    show(w.compTaps, page === PAGE_PRAYERS)
    this.renderBar(page === PAGE_PRAYERS ? cd.frac : -1, cdColor)
    this.renderExtrasRow()
    if (w.page1) {
      show(w.page1, page === PAGE_EXTRAS)
      show(w.page2, page === PAGE_MAKRUH)
    }

    if (page === PAGE_PRAYERS) {
      setText(w.next, nextStr)
      setColor(w.next, cdColor)
      for (const k of PRAYER_ORDER) {
        const on = k === next
        setColor(w.cells[k].name, on ? C_GOLD : C_DIM)
        setColor(w.cells[k].time, on ? C_GOLD : C_WHITE)
      }
    } else if (page === PAGE_EXTRAS) {
      setText(w.next, line(T, T.pageNight))
      setColor(w.next, C_DIM)
      this.renderExtras(nowMin)
    } else {
      setText(w.next, line(T, T.pageMakruh))
      setColor(w.next, C_RED)
      this.renderMakruh(nowMin)
    }
  },

  // frac < 0 hides the bar (other pages).
  renderBar(frac, color) {
    const fw = frac >= 0 ? Math.round(BAR.w * frac) : 0
    show([w.barTrack], frac >= 0)
    show([w.barFill], fw >= 2)
    const fill = `${fw}|${color}`
    if (fw >= 2 && w.barShape !== fill) {
      w.barShape = fill
      w.barFill.setProperty(prop.MORE, { ...box({ x: BAR.x + BAR.w - fw, y: BAR.y, w: fw, h: BAR.h }), radius: 2, color })
    }
  },

  renderExtras(nowMin) {
    const t = state.today
    // Before today's Fajr we're still in last night (yesterday's Maghrib → today's Fajr).
    const night = nowMin < t.fajr ? nightPortions(state.yesterdayMaghrib, t.fajr) : nightPortions(t.maghrib, state.tomorrowFajr)
    const items = extraItems(T, night, t, state.eid, { fajr: S.extraFajrAngle, isha: S.extraIshaAngle }, digits)

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
      setText(r.range, rangeLine(T, fmtTime(a), fmtTime(b)))
      setColor(r.label, active ? C_RED : C_DIM)
      setColor(r.range, active ? C_RED : C_WHITE)
    }
  },

  onDestroy() {
    last.clear()
    made = []
    menu = null
    time = null
    w = {}
  },
})
