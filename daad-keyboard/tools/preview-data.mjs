// Runs the real keyboard (data-widget/index.page.js) on the stub @zos modules and prints the widgets
// it shows, in screen coordinates and drawing order, as JSON for tools/gen-previews.py.
//   node tools/preview-data.mjs LETTERS TEXT [WIDTH HEIGHT FIELD_H]
import { stub } from './zos-stub.mjs'

const [letters, text, width, height, fieldH] = process.argv.slice(2)
Object.assign(stub, { letters, text })
if (width) Object.assign(stub, { width: +width, height: +height, fieldH: +fieldH })
await import('../data-widget/index.page.js')
const def = stub.def
def.build.call(def)
clearTimeout(def.warm) // the background page build; the preview shows only the first page

const shown = (w) => w.visible && (!w.parent || shown(w.parent))
const at = (w) => (w.parent ? { x: w.o.x + at(w.parent).x, y: w.o.y + at(w.parent).y } : { x: w.o.x, y: w.o.y })
const out = stub.widgets
  .filter((w) => w.type !== 'GROUP' && shown(w))
  .map((w) => ({ type: w.type, ...w.o, ...at(w) }))
  .map(({ click_func, longpress_func, ...o }) => o)
console.log(JSON.stringify({ width: stub.width, height: stub.height, widgets: out }))
