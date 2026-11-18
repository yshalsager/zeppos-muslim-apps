import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { layout } from '../lib/layout.js'
const devices = JSON.parse(readFileSync(new URL('../../devices.json', import.meta.url)))
const boxes = (v) => v && typeof v === 'object' ? 'x' in v ? [v] : Object.values(v).flatMap(boxes) : []
const overlap = (a, b) => Math.min(a.x + a.w, b.x + b.w) > Math.max(a.x, b.x) && Math.min(a.y + a.h, b.y + b.h) > Math.max(a.y, b.y)
function fits(b, d) {
  assert.ok(b.x >= 0 && b.y >= 0 && b.x + b.w <= d.width && b.y + b.h <= d.height, JSON.stringify(b))
  for (const x of [b.x, b.x + b.w]) for (const y of [b.y, b.y + b.h]) {
    const cx = Math.min(Math.max(x, d.radius), d.width - d.radius)
    const cy = Math.min(Math.max(y, d.radius), d.height - d.radius)
    assert.ok(Math.hypot(x - cx, y - cy) <= d.radius + 1, `outside rounded screen ${JSON.stringify(b)}`)
  }
}
for (const [name, d] of Object.entries(devices).filter(([k]) => k !== '//')) {
  for (const rtl of [false, true]) test(`${name} ${rtl ? 'ar' : 'en'}: fixed boxes fit and scrolling rows are readable in the centre`, () => {
    const l = layout(d.width, d.height, rtl)
    for (const b of boxes(l)) fits(b, d)
    for (const b of [...l.keys, l.value, l.from, l.to, l.swap, l.favourite, l.ingredient, l.ingredientSwap, l.ingredientStar]) {
      assert.ok(b.w >= 30 && b.h >= 30, JSON.stringify(b))
      if (d.shape === 'round') assert.ok(b.y + b.h <= d.height * .875 + 1)
    }
    for (let i = 0; i < 30; i++) {
      const b = l.row(i)
      assert.ok(b.w >= 30 && b.h >= 30)
      fits({ ...b, y: (d.height - b.h) / 2 }, d)
      if (i) assert.ok(!overlap(b, l.row(i - 1)))
    }
    for (const page of [[l.title, l.value, l.from, l.swap, l.favourite, l.result, l.to, l.note], [l.title, l.input, ...l.keys], [l.title, l.value, l.from, l.ingredient, l.ingredientSwap, l.ingredientStar, l.result, l.to, l.note]]) {
      for (let i = 0; i < page.length; i++) for (let j = i + 1; j < page.length; j++) assert.ok(!overlap(page[i], page[j]), `${i},${j}`)
    }
  })
  test(`${name}: every real page in both languages has reachable, non-overlapping content`, () => {
    for (const lang of ['en', 'ar']) for (const [page, params, mode = ''] of [['index', ''], ['converter', ''], ['keypad', ''], ['units', 'from'], ['islamic', ''], ['settings', ''], ['opinions', 'qasr'], ['converter', '', 'karats'], ['converter', '', 'coins'], ['units', 'from', 'land'], ['units', 'from', 'karats'], ['keypad', '', 'indic'], ['converter', '', 'ingredients'], ['ingredients', '', 'ingredients'], ['converter', '', 'fuel'], ['converter', '', 'oven'], ['opinions', 'poor_person'], ['converter', '', 'mahr'], ['units', 'from', 'mahr'], ['recent', ''], ['recent', '', 'empty']]) {
      const data = JSON.parse(execFileSync(process.execPath, ['tools/preview-data.mjs', page, lang, mode, params, String(d.width), String(d.height)], { encoding: 'utf8' }))
      for (const b of data.widgets.filter((w) => w.w > 1)) {
        if (data.scrolling) {
          assert.ok(b.y + b.h <= data.content_height)
          assert.ok(Math.max(0, b.y + b.h / 2 - d.height / 2) <= data.content_height - d.height)
          fits({ ...b, y: (d.height - b.h) / 2 }, d)
        } else fits(b, d)
        if (b.type === 'BUTTON') assert.ok(b.w >= 30 && b.h >= 30)
      }
      const content = data.widgets.filter((w) => w.type !== 'FILL_RECT')
      for (let i = 0; i < content.length; i++) for (let j = i + 1; j < content.length; j++) assert.ok(!overlap(content[i], content[j]), `${page} ${lang} ${i},${j}`)
      if (page === 'keypad') assert.ok(data.widgets.some((w) => w.text === (mode === 'indic' ? '٧' : '7')))
    }
  })
}
