// Minimal @zos/* for running the face in Node (tools/docs-menu.mjs). Widgets record their
// properties; tap(x, y) goes to the topmost visible widget there, as on the watch (a later widget
// takes the taps, even without a listener). Fixed time: Zepp's preview time on the docs day.
import { readFileSync as read } from 'node:fs'

const ASSETS = new URL('../../assets/bip-max/', import.meta.url)
export const stub = { widgets: [], storage: {}, now: new Date(2026, 10, 12, 10, 9) }

function createWidget(type, o = {}) {
  const w = {
    type, o: { ...o }, visible: true, on: {},
    setProperty(p, v) {
      if (p === 'VISIBLE') this.visible = v
      else if (p === 'TEXT') this.o.text = v
      else if (p === 'MORE') Object.assign(this.o, v)
    },
    getProperty() { return 0 },
    addEventListener(e, f) { this.on[e] = f },
  }
  stub.widgets.push(w)
  return w
}
const names = new Proxy({}, { get: (_, k) => k })
export default {
  createWidget, deleteWidget() {}, widget: names, prop: names, align: names, data_type: names, text_style: names,
  show_level: { ONLY_NORMAL: 1, ONLY_AOD: 2, ONLY_EDIT: 4 }, event: { CLICK_DOWN: 'down', CLICK_UP: 'up' },
}

export function tap(x, y) {
  for (let i = stub.widgets.length - 1; i >= 0; i--) {
    const w = stub.widgets[i]
    const { x: wx, y: wy, w: ww, h: wh, show_level } = w.o
    if (!w.visible || show_level === 2 || ww === undefined || x < wx || x >= wx + ww || y < wy || y >= wy + wh) continue
    if (w.on.down) w.on.down({ x, y })
    if (w.on.up) w.on.up({ x, y })
    return
  }
}

export class Time {
  getFullYear() { return stub.now.getFullYear() }
  getMonth() { return stub.now.getMonth() + 1 }
  getDate() { return stub.now.getDate() }
  getHours() { return stub.now.getHours() }
  getMinutes() { return stub.now.getMinutes() }
  getDay() { return stub.now.getDay() || 7 }
  getTime() { // the instant those local fields are in Cairo (UTC+2), whatever the host's timezone
    const n = stub.now
    return Date.UTC(n.getFullYear(), n.getMonth(), n.getDate(), n.getHours(), n.getMinutes()) - 2 * 3600000
  }
  onPerMinute() {}
  onPerDay() {}
}
export class Battery { getCurrent() { return 88 } }
export class Step { getCurrent() { return 6210 } }
export class HeartRate { getLast() { return 72 } }
export class Calorie { getCurrent() { return 320 } }
export const getScene = () => 1
export const SCENE_AOD = 4
export const getTimeFormat = () => 0
export const TIME_FORMAT_24 = 1
export const launchApp = () => {}
export const SYSTEM_APP_WEATHER = 1, SYSTEM_APP_STATUS = 2, SYSTEM_APP_HR = 3
export class LocalStorage {
  getItem(k, d) { return k in stub.storage ? stub.storage[k] : d }
  setItem(k, v) { stub.storage[k] = v }
  removeItem(k) { delete stub.storage[k] }
}
export class TypedStorage { getInt64(k, d) { return d } getDouble(k, d) { return d } }
export const readFileSync = ({ path }) => read(new URL(path.replace('assets://', ''), ASSETS), 'utf8')
export const openAssetsSync = () => 0, statAssetsSync = () => undefined, readSync = () => 0, closeSync = () => {}, O_RDONLY = 0
