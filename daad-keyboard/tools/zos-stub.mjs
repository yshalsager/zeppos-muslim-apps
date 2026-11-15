// Minimal @zos/* for running the keyboard in Node (tools/preview-data.mjs). Widgets record their
// properties; nothing is drawn (../../shared/zos-stub.mjs). serve() sends every @zos/* import here.
import { serve, widgets } from '../../shared/zos-stub.mjs'

// What the keyboard sees: screen, input field, typed text, saved language (set before importing it).
export const stub = { widgets: [], width: 432, height: 514, fieldH: 132, text: '', letters: 'ar', def: null }

const make = widgets(stub)
const names = new Proxy({}, { get: (_, k) => k })
const keyboard = {
  getContentRect: () => ({ x: 0, y: 0, w: stub.width, h: stub.fieldH }),
  getTextContext: () => stub.text,
  isSelected: () => true,
  inputText() {}, backspace() {}, sendFnKey() {}, switchInputType() {},
  ENTER: 'ENTER', SWITCH: 'SWITCH', SELECT: 'SELECT',
}
const ui = {
  createWidget: make,
  deleteWidget(w) { w.visible = false },
  widget: names, prop: names, align: names, text_style: names, event: names, inputType: names,
  keyboard, getRtlLayout: () => stub.letters === 'ar',
}
const device = { getDeviceInfo: () => ({ width: stub.width, height: stub.height }) }
const storage = { LocalStorage: class { getItem() { return stub.letters } setItem() {} } }
const sensor = { Vibrator: class { setMode() {} start() {} }, VIBRATOR_SCENE_SHORT_LIGHT: 0 }
globalThis.DataWidget = (def) => { stub.def = def }

serve({ ui, device, storage, sensor })
