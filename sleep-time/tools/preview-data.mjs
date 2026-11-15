// Runs a page on the stub @zos modules and prints the widgets it shows, in drawing order, as JSON
// for tools/gen-previews.py. The watch clock reads 22:40 (06:25 on the ring page).
//   node tools/preview-data.mjs PAGE LANG [MODE] [PARAMS] [WIDTH HEIGHT]   e.g. index ar now; alarm en '' '{"wake":385}'
// The main page in "now" mode also has an alarm set, to show the alarm chip. The alarm page with
// MODE "dnd" reads Do Not Disturb as on; otherwise the watch doesn't say.
import { stub } from './zos-stub.mjs'

const [page, lang, mode = 'wake', params, width, height] = process.argv.slice(2)
if (width) Object.assign(stub, { width: +width, height: +height })
const sec = 1_800_000_000
const sod = (page === 'ring' ? 6 * 60 + 25 : 22 * 60 + 40) * 60
Object.assign(stub, { lang: lang === 'ar' ? 13 : 2, clock: { sec, sod } })
stub.store.settings = JSON.stringify({ mode: page === 'index' ? mode : 'wake', wake: 6 * 60 + 30, bed: 23 * 60 })
if (mode === 'dnd') stub.systemMode = { DND: true, sleep: false }
if (page === 'index' && mode === 'now') stub.store.alarm = JSON.stringify({ wake: { id: 1, at: sec + (7 * 60 + 45) * 60 }, remind: null, auto: 0 })
await import(`../page/${page}.js`)
const def = stub.pages[0]
if (def.onInit) def.onInit(params)
def.build.call(def)
// tap areas are IMGs without an image
const out = stub.widgets.filter((w) => w.visible && (w.type !== 'IMG' || w.o.src)).map(({ type, o: { click_func, ...o } }) => ({ type, ...o }))
console.log(JSON.stringify({ width: stub.width, height: stub.height, widgets: out }))
