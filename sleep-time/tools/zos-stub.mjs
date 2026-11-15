// Minimal @zos/* for running the pages in Node (tools/preview-data.mjs, test/*.test.js). Widgets
// record their properties; nothing is drawn. Alarms, vibration and storage are recorded in `stub`.
// Set `stub` before importing a page.
import { registerHooks } from 'node:module'

export const stub = {
  widgets: [], width: 432, height: 514, lang: 2, h24: true, store: {}, pages: [],
  clock: { sec: 1_800_000_000, sod: 23 * 3600 }, // UTC seconds, local seconds since midnight
  alarms: new Map(), nextAlarm: 1, alarmFails: false, vibrating: null, pushed: null, exited: false, launched: null, timers: [],
}

function make(type, o) {
  const w = {
    type, o: { ...o }, visible: true, listeners: {},
    setProperty(p, v) {
      if (p === 'TEXT') this.o.text = v
      else if (p === 'VISIBLE') this.visible = v
    },
    addEventListener(e, fn) { this.listeners[e] = fn },
  }
  stub.widgets.push(w)
  return w
}

const names = new Proxy({}, { get: (_, k) => k })
const parts = {
  ui: { createWidget: make, deleteWidget(w) { w.visible = false }, setStatusBarVisible() {}, widget: names, prop: names, align: names, event: names, text_style: names },
  router: {
    push({ url, params }) { stub.pushed = { url, params } },
    back() { stub.backed = true },
    exit() { stub.exited = true },
    launchApp(o) { stub.launched = o },
    SYSTEM_APP_ALARM: 'ALARM',
  },
  sensor: {
    Time: class {
      getTime() { return stub.clock.sec * 1000 }
      getHours() { return Math.floor(stub.clock.sod / 3600) }
      getMinutes() { return Math.floor(stub.clock.sod / 60) % 60 }
      getSeconds() { return stub.clock.sod % 60 }
      onPerMinute() {}
    },
    Vibrator: class { setMode(m) { this.m = m } start() { stub.vibrating = this.m } stop() { stub.vibrating = null } },
    VIBRATOR_SCENE_TIMER: 'TIMER', VIBRATOR_SCENE_NOTIFICATION: 'NOTIFICATION',
  },
  alarm: {
    set(o) {
      if (stub.alarmFails) return 0
      const id = stub.nextAlarm++
      stub.alarms.set(id, o)
      return id
    },
    cancel(id) { stub.alarms.delete(id) },
  },
  display: { setPageBrightTime() {}, pauseDropWristScreenOff() {}, resetDropWristScreenOff() {} },
  device: { getDeviceInfo: () => ({ width: stub.width, height: stub.height }) },
  // systemMode: what getSystemMode() returns ({ DND, sleep }); undefined = the watch doesn't say
  settings: { getLanguage: () => stub.lang, getTimeFormat: () => (stub.h24 ? 1 : 0), TIME_FORMAT_24: 1, getSystemMode: () => stub.systemMode },
  storage: { LocalStorage: class { getItem(k) { return stub.store[k] || '' } setItem(k, v) { stub.store[k] = v } } },
}
globalThis.Page = (def) => stub.pages.push(def)
// The pages defer work with setTimeout: 0 runs now, longer delays wait for the test to run them
globalThis.setTimeout = (fn, ms) => (ms ? stub.timers.push({ fn, ms }) : fn(), stub.timers.length)
globalThis.clearTimeout = (i) => { if (stub.timers[i - 1]) stub.timers[i - 1].fn = () => {} }

const HERE = new URL(import.meta.url).href
registerHooks({
  resolve(spec, ctx, next) {
    const m = spec.startsWith('@zos/') && spec.slice(5)
    if (m && parts[m]) return { url: `${HERE}?m=${m}`, shortCircuit: true }
    if (spec.startsWith('.') && !/\.\w+$/.test(spec)) return next(spec + '.js', ctx) // zeus-style imports
    return next(spec, ctx)
  },
  load(url, ctx, next) {
    const m = url.startsWith(HERE + '?m=') && url.slice(HERE.length + 3)
    if (!m) return next(url, ctx)
    const source = `export const { ${Object.keys(parts[m]).join(', ')} } = globalThis.__zos.${m}\n`
    return { format: 'module', source, shortCircuit: true }
  },
})
globalThis.__zos = parts
