import { createWidget, widget, align, prop, text_style } from '@zos/ui'
import { Geolocation } from '@zos/sensor'
import { ShareTypedStorage } from '@zos/storage'
import { LOCATION_SCOPE, KEY_LAT, KEY_LON, KEY_UPDATED } from '../shared.js'

const W = 432
const TIMEOUT_MS = 3 * 60 * 1000
const store = new ShareTypedStorage(LOCATION_SCOPE)

let geo = null
let timeoutId = null
let ui = {}

const fmtSaved = () => {
  if (!store.has(KEY_LAT)) return 'لا يوجد موقع محفوظ\n(الافتراضي: القاهرة)'
  const lat = store.getDouble(KEY_LAT, 0).toFixed(4)
  const lon = store.getDouble(KEY_LON, 0).toFixed(4)
  const t = new Date(store.getInt64(KEY_UPDATED, 0))
  const when = `${t.getFullYear()}-${t.getMonth() + 1}-${t.getDate()} ${t.getHours()}:${String(t.getMinutes()).padStart(2, '0')}`
  return `${lat}, ${lon}\n${when}`
}

function stopGps() {
  if (timeoutId) { clearTimeout(timeoutId); timeoutId = null }
  if (geo) { geo.offChange(onGeo); geo.stop(); geo = null }
}

function onGeo() {
  if (!geo || geo.getStatus() !== 'A') return
  const lat = geo.getLatitude()
  const lon = geo.getLongitude()
  if (typeof lat !== 'number' || typeof lon !== 'number' || (lat === 0 && lon === 0)) return
  store.putDouble(KEY_LAT, lat)
  store.putDouble(KEY_LON, lon)
  store.putInt64(KEY_UPDATED, Date.now())
  stopGps()
  ui.saved.setProperty(prop.TEXT, fmtSaved())
  ui.status.setProperty(prop.TEXT, 'تم الحفظ ✓')
}

function startGps() {
  if (geo) return
  geo = new Geolocation()
  geo.onChange(onGeo)
  geo.start()
  ui.status.setProperty(prop.TEXT, 'جارٍ تحديد الموقع… (اخرج لمكان مفتوح)')
  timeoutId = setTimeout(() => {
    stopGps()
    ui.status.setProperty(prop.TEXT, 'تعذّر تحديد الموقع، حاول مجددًا')
  }, TIMEOUT_MS)
}

Page({
  build() {
    createWidget(widget.TEXT, {
      x: 16, y: 40, w: W - 32, h: 50, text: 'موقع مواقيت الصلاة',
      text_size: 34, color: 0xfacc15, align_h: align.CENTER_H,
    })
    ui.saved = createWidget(widget.TEXT, {
      x: 16, y: 110, w: W - 32, h: 110, text: fmtSaved(),
      text_size: 30, color: 0xffffff, align_h: align.CENTER_H, text_style: text_style.WRAP,
    })
    ui.status = createWidget(widget.TEXT, {
      x: 16, y: 240, w: W - 32, h: 100, text: '',
      text_size: 26, color: 0x9ca3af, align_h: align.CENTER_H, text_style: text_style.WRAP,
    })
    createWidget(widget.BUTTON, {
      x: 56, y: 370, w: 320, h: 72, radius: 36, text: 'تحديث الموقع',
      text_size: 30, normal_color: 0x0f766e, press_color: 0x115e59,
      click_func: startGps,
    })
  },
  onDestroy() {
    stopGps()
  },
})
