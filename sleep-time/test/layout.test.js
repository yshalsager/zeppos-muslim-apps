import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { layout } from '../lib/layout.js'

// Each app.json target's screen: [width, height, corner radius], from ../../devices.json
const DEVICES = JSON.parse(readFileSync(new URL('../../devices.json', import.meta.url), 'utf8'))
const app = JSON.parse(readFileSync(new URL('../app.json', import.meta.url), 'utf8'))
const SCREENS = Object.fromEntries(Object.keys(app.targets).map((t) => [t, [DEVICES[t].width, DEVICES[t].height, DEVICES[t].radius]]))

// Inside a rounded rectangle (a circle when the radius is half the width), allowing 1.5 px for rounding
const inside = (W, H, R) => (x, y) => {
  if (x < 0 || y < 0 || x > W || y > H) return false
  const cx = Math.min(Math.max(x, R), W - R)
  const cy = Math.min(Math.max(y, R), H - R)
  return Math.hypot(x - cx, y - cy) <= R + 1.5
}
const boxes = (o) => (o && typeof o === 'object' ? ('w' in o ? [o] : Object.values(o).flatMap(boxes)) : [])
const overlap = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h

for (const [name, [W, H, R]] of Object.entries(SCREENS)) {
  for (const rtl of [false, true]) {
    test(`${name}${rtl ? ' (right to left)' : ''}: every box is on the screen, taps are big enough`, () => {
      const L = layout(W, H, rtl)
      const ok = inside(W, H, R)
      for (const b of [L.main, L.settings, L.alarm, L.ring].flatMap(boxes)) {
        const corners = [[b.x, b.y], [b.x + b.w, b.y], [b.x, b.y + b.h], [b.x + b.w, b.y + b.h]]
        assert.ok(corners.every(([x, y]) => ok(x, y)), JSON.stringify(b))
        if (b.radius !== undefined) assert.ok(Math.min(b.w, b.h) >= 30, `small tap target ${JSON.stringify(b)}`) // 30 px: the smallest button, on 360 × 360
      }
      // things you tap don't overlap each other
      // both states of the bottom row: Settings alone, or the alarm chip and the gear
      const M = L.main
      const top = [...M.tabs, M.hour.minus, M.hour.plus, M.minute.minus, M.minute.plus, ...M.cells.map((c) => c.cell)]
      for (const taps of [[...top, M.settings], [...top, M.chip, M.gear]]) {
        for (const a of taps) for (const b of taps) assert.ok(a === b || !overlap(a, b), `${JSON.stringify(a)} / ${JSON.stringify(b)}`)
      }
      const inside2 = (a, b) => a.x >= b.x && a.y >= b.y && a.x + a.w <= b.x + b.w && a.y + a.h <= b.y + b.h
      assert.ok(inside2(M.chipIcon, M.chip) && inside2(M.chipText, M.chip) && !overlap(M.chipIcon, M.chipText))
      assert.equal(M.gear.w, M.gear.h) // a round button from a square image
      // round: nothing tappable in the bottom 60 px (at 480), where the swipe-up gesture starts
      if (W === H) for (const b of [L.main, L.settings, L.alarm, L.ring].flatMap(boxes).filter((b) => b.radius !== undefined)) assert.ok(b.y + b.h <= H - (60 * W) / 480 + 1, JSON.stringify(b))
      assert.equal(M.chip.x > M.gear.x, rtl) // right to left: chip on the right, gear on the left
      assert.equal(M.chipIcon.x > M.chipText.x, rtl)
      const pages = [L.settings.rows.flatMap((r) => [r.minus, r.plus]).concat(L.settings.test), [L.ring.snooze, L.ring.stop]]
      for (const p of pages) for (const a of p) for (const b of p) assert.ok(a === b || !overlap(a, b))
      // right to left puts the first tab and result on the right
      assert.equal(L.main.tabs[0].x > L.main.tabs[2].x, rtl)
      assert.equal(L.main.cells[0].cell.x > L.main.cells[1].cell.x, rtl)
    })
  }
}
