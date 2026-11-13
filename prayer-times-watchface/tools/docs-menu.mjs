// Prints settings-menu screens as JSON for tools/gen-docs.py (README screenshots). Runs the face's
// real code (watchface/index.js, menu.js, screens.js) on stub @zos modules, taps through the menu
// and records what's visible. Run: node --import ./tools/zos-stub/register.mjs tools/docs-menu.mjs
import { stub, tap } from './zos-stub/stub.mjs'

// Settings shown: "standard" iqama and an extra Fajr at 14.6°
stub.storage.settings = JSON.stringify({ iqama: [20, 15, 15, 10, 15], extraFajrAngle: 14.6 })
let face
globalThis.WatchFace = (o) => { face = o }
await import('../watchface/index.js')
face.build()

const row = (i) => 126 + i * 68 + 34 // watchface/menu.js ROW_Y, ROW_H
const BACK = [216, 55]
const shot = () => {
  const from = stub.widgets.findIndex((w) => w.o.color === 0x2a2a2a) - 1 // the menu's background
  return stub.widgets.slice(from).filter((w) => w.visible && w.type !== 'FILL_RECT' || (w.visible && w.o.alpha !== 0))
    .map(({ type, o }) => ({ type, x: o.x, y: o.y, w: o.w, h: o.h, text: o.text, size: o.text_size, color: o.color, font: o.font, src: o.src }))
}
const screens = {}
tap(216, 210) // the date line opens the menu
screens.root = shot()
tap(216, row(1)); screens.method = shot(); tap(...BACK)
tap(216, 420); tap(216, row(1)); tap(216, row(0)); screens.value = shot(); tap(...BACK); tap(...BACK); tap(216, 103)
tap(216, row(0)); tap(216, row(2)); screens.index = shot()
console.log(JSON.stringify(screens))
