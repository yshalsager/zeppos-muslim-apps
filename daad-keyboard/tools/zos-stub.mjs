// Minimal @zos/* for running the keyboard in Node (tools/preview-data.mjs). Widgets record their
// properties; nothing is drawn. The register hook below sends every @zos/* import here, and lets
// the watch code's extension-less relative imports ('./text') resolve as zeus does.
import { registerHooks } from 'node:module'

// What the keyboard sees: screen, input field, typed text, saved language (set before importing it).
export const stub = { widgets: [], width: 432, height: 514, fieldH: 132, text: '', letters: 'ar', def: null }

function make(type, o, parent) {
  const w = {
    type, o: { ...o }, parent, visible: true,
    setProperty(p, v) {
      if (p === 'VISIBLE') this.visible = v
      else if (p === 'TEXT') this.o.text = v
      else if (p === 'COLOR') this.o.color = v
      else if (p === 'MORE') Object.assign(this.o, v)
    },
    getProperty() { return 0 },
    addEventListener() {},
    createWidget(t, props) { return make(t, props, this) }, // GROUP children: positions relative to it
  }
  stub.widgets.push(w)
  return w
}

const names = new Proxy({}, { get: (_, k) => k })
const keyboard = {
  getContentRect: () => ({ x: 0, y: 0, w: stub.width, h: stub.fieldH }),
  getTextContext: () => stub.text,
  isSelected: () => true,
  inputText() {}, backspace() {}, sendFnKey() {}, switchInputType() {},
  ENTER: 'ENTER', SWITCH: 'SWITCH', SELECT: 'SELECT',
}
export const ui = {
  createWidget: (t, o) => make(t, o, null),
  deleteWidget(w) { w.visible = false },
  widget: names, prop: names, align: names, text_style: names, event: names, inputType: names,
  keyboard, getRtlLayout: () => stub.letters === 'ar',
}
export const device = { getDeviceInfo: () => ({ width: stub.width, height: stub.height }) }
export const storage = { LocalStorage: class { getItem() { return stub.letters } setItem() {} } }
export const sensor = { Vibrator: class { setMode() {} start() {} }, VIBRATOR_SCENE_SHORT_LIGHT: 0 }
globalThis.DataWidget = (def) => { stub.def = def }

const MODULES = { '@zos/ui': 'ui', '@zos/device': 'device', '@zos/storage': 'storage', '@zos/sensor': 'sensor' }
const HERE = new URL(import.meta.url).href
registerHooks({
  resolve(spec, ctx, next) {
    if (MODULES[spec]) return { url: `${HERE}?m=${MODULES[spec]}`, shortCircuit: true }
    if (spec.startsWith('.') && !/\.\w+$/.test(spec)) return next(spec + '.js', ctx)
    return next(spec, ctx)
  },
  load(url, ctx, next) {
    const m = url.startsWith(HERE + '?m=') && url.slice(HERE.length + 3)
    if (!m) return next(url, ctx)
    // Re-export one part of this module as if it were that @zos module.
    const names = Object.keys({ ui, device, storage, sensor }[m])
    const source = `import { ${m} as s } from ${JSON.stringify(HERE)}\nexport const { ${names.join(', ')} } = s\n`
    return { format: 'module', source, shortCircuit: true }
  },
})
