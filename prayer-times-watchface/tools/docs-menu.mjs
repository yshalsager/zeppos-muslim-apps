// Prints settings-menu screens as JSON for tools/gen-docs.py (README screenshots). Runs the face's
// real code (watchface/index.js, menu.js, screens.js) on stub @zos modules, taps through the menu
// and records what's visible. Run: node --import ./tools/zos-stub/register.mjs tools/docs-menu.mjs [lang]
import { stub, tap, getDeviceInfo } from './zos-stub/stub.mjs'
import { layout } from '../lib/layout.js'

// Settings shown: "standard" iqama and an extra Fajr at 14.6°, in the given language (default ar)
const language = process.argv[2] || 'ar'
stub.storage.settings = JSON.stringify({ iqama: [20, 15, 15, 10, 15], extraFajrAngle: 14.6, language })
let face
globalThis.WatchFace = (o) => { face = o }
await import('../watchface/index.js')
face.build()

// tap points: the centres of lib/layout.js boxes, for the device the stub reports
const M = layout(getDeviceInfo().width, getDeviceInfo().height)
const centre = (b) => [b.x + b.w / 2, b.y + b.h / 2]
const row = (i) => centre(M.menu.row[i].tap)
const BACK = centre(M.menu.titleTap)
const shot = () => {
  const from = stub.widgets.findIndex((w) => w.o.color === 0x2a2a2a) - 1 // the menu's background
  return stub.widgets.slice(from).filter((w) => w.visible && w.type !== 'FILL_RECT' || (w.visible && w.o.alpha !== 0))
    .map(({ type, o }) => ({ type, x: o.x, y: o.y, w: o.w, h: o.h, text: o.text, size: o.text_size, color: o.color, font: o.font, src: o.src }))
}
const screens = {}
tap(...centre(M.dateTap)) // the date line opens the menu
screens.root = shot()
tap(...row(1)); screens.method = shot(); tap(...BACK)
// page 2: Extra times → Extra Fajr (value screen), then back to the top for a city index
tap(...centre(M.menu.downTap)); tap(...row(2)); tap(...row(0)); screens.value = shot(); tap(...BACK); tap(...BACK); tap(...centre(M.menu.upTap))
tap(...row(0)); tap(...row(2)); screens.index = shot()
console.log(JSON.stringify(screens))
