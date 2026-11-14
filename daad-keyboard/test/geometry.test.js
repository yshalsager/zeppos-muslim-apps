import { test } from 'node:test'
import assert from 'node:assert/strict'
import { span, cells, grid, widestRow } from '../lib/geometry.js'

test('rectangles keep their fixed margins and the old even key split', () => {
  assert.deepEqual(span(432, 514, 0, 100, 12), { x: 12, w: 408 })
  for (const [W, n] of [[432, 11], [390, 11], [390, 9]]) {
    const keyW = Math.floor((W - 24) / n)
    const x0 = Math.floor((W - keyW * n) / 2)
    assert.deepEqual(cells(span(W, W + 1, 0, 1, 12), Array(n).fill(1)).map((c) => c.x), [...Array(n)].map((_, i) => x0 + i * keyW))
  }
})

test('a circle is widest at the middle and narrows toward the edges', () => {
  assert.equal(span(480, 480, 200, 280, 0).w, 472) // each edge rounded inward
  assert.ok(span(480, 480, 40, 120, 0).w < span(480, 480, 120, 200, 0).w)
})

// Weights per row of each page, as index.page.js lays them out on a round screen: the widest row
// gets the EN/ع and ١٢٣ keys (1.5) at its ends; a phrase is 4.
const side = (rows, i) => rows.map((r, j) => (j === i ? [1.5, ...r, 1.5] : r))
const row = (n, w = 1) => Array(n).fill(w)
const PAGES = {
  ar: [row(11), row(11), row(11)],
  en: [row(10), row(9), row(8), row(10)],
  sym: [row(10), row(10), row(10), row(10)],
  phr: [...row(7).map(() => row(2, 4))],
}

test('every key fits inside the circle on 466 and 480 screens, at any field height', () => {
  for (const W of [466, 480]) {
    const r = W / 2
    const inside = (x, y) => Math.hypot(x - r, y - r) <= r + 1
    // The firmware's input field height on round screens is unmeasured; cover a range.
    for (const fieldH of [60, 100, 140, 180]) {
      const top = Math.max(fieldH + 8, Math.round(W * 0.22)) // as in index.page.js
      const bottom = W - Math.round(W * 0.1)
      const actionH = Math.floor((bottom - top) / 5)
      const actionY = bottom - actionH
      const boxes = Object.values(PAGES).flatMap((rows) => grid(W, W, top, actionY, side(rows, widestRow(W, W, top, actionY, rows.length)), 4).flat())
      boxes.push(...cells(span(W, W, actionY, bottom, 4), [1, 1, 2, 1, 1]).map(({ x, w }) => ({ x, y: actionY, w, h: actionH })))
      for (const b of boxes) {
        const corners = [[b.x, b.y], [b.x + b.w, b.y], [b.x, b.y + b.h], [b.x + b.w, b.y + b.h]]
        assert.ok(corners.every(([x, y]) => inside(x, y)), `${W} field ${fieldH}: ${JSON.stringify(b)}`)
        assert.ok(b.w >= 26, `${W} field ${fieldH}: key too narrow ${JSON.stringify(b)}`)
      }
    }
  }
})
