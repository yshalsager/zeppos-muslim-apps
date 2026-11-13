// Every box the face draws, for one screen size. The design is the Bip Max's (432 × 514); other
// screens get it scaled (x by width, y by height, text and icons by the smaller of the two), so the
// Bip Max itself is drawn exactly as designed. Used by watchface/index.js and menu.js, and by the
// image generators through tools/layout-data.mjs, so previews and screenshots match the watch.
//
// Boxes are { x, y, w, h } (text boxes also carry text_size) in right-to-left order: slot 0 is the
// rightmost; watchface/index.js mirrors them for left-to-right languages.
export const DESIGN = { width: 432, height: 514 }

export function layout(width = DESIGN.width, height = DESIGN.height) {
  const sx = width / DESIGN.width
  const sy = height / DESIGN.height
  const sz = Math.min(sx, sy)
  const X = (v) => Math.round(v * sx)
  const Y = (v) => Math.round(v * sy)
  const Z = (v) => Math.round(v * sz)
  const box = (x, y, w, h) => ({ x: X(x), y: Y(y), w: X(w), h: Y(h) })
  const label = (x, y, w, h, size) => ({ ...box(x, y, w, h), text_size: Z(size) })
  const icon = Z(24)
  // an icon box: its right edge at x, vertically centred at cy
  const iconAt = (x, cy) => ({ x: X(x) - icon, y: Y(cy) - Math.round(icon / 2), w: icon, h: icon })

  // Prayer grid and page 1: 3 columns of 132 px, 134 apart, column 0 on the right
  const colX = (col) => 16 + (2 - col) * 134
  const COMP_X = [276, 156, 36] // extras row, slot 0 on the right
  const COMP = { y: 442, w: 120, h: 52 }

  // Settings menu (watchface/menu.js)
  const ROWS = 4
  const ROW_Y = 126
  const ROW_H = 68 // rows touch: every pixel between them is part of a row
  const DOWN_Y = ROW_Y + ROWS * ROW_H + 2
  const SIDE_X = 16 + 200 + 8 // rows with a value: value column 16…216, label from here

  return {
    width, height, icon,
    // top half
    hijri: label(16, 34, 400, 44, 32),
    time: label(0, 80, 432, 120, 112),
    greg: label(48, 198, 336, 36, 26),
    gear: { x: X(20), y: Y(204), w: icon, h: icon }, // ⚙ at the end of the date line
    next: label(16, 240, 400, 44, 30),
    bar: box(116, 287, 200, 4), // progress toward the next prayer
    // tap areas: the date line opens the menu, the lower half cycles pages
    dateTap: box(16, 194, 400, 44),
    gridTap: box(16, 290, 400, 216),
    // page 0: 2 rows × 3 columns
    prayers: [0, 1, 2, 3, 4, 5].map((i) => {
      const x = colX(i % 3)
      const y = 296 + Math.floor(i / 3) * 70
      return { name: label(x, y, 132, 30, 24), time: label(x, y + 28, 132, 38, 32) }
    }),
    // extras row under the grid: icon first in reading order, then the value
    comps: COMP_X.map((x) => ({
      cell: label(x, COMP.y, COMP.w, COMP.h, 20), // text_size: the edit preview's "none" label
      icon: iconAt(x + COMP.w - 4, COMP.y + COMP.h / 2),
      value: label(x, COMP.y, COMP.w - 32, COMP.h, 24),
      temp: label(x, COMP.y + 10, COMP.w - 32, 34, 26), // firmware-drawn temperature (digit images)
    })),
    // page 1: 3 rows × 3 columns
    extras: [0, 1, 2, 3, 4, 5, 6, 7, 8].map((i) => {
      const x = colX(i % 3)
      const y = 294 + Math.floor(i / 3) * 70
      return { name: label(x, y, 132, 28, 19), time: label(x, y + 26, 132, 38, 30) }
    }),
    // page 2: label first in reading order, then the range
    makruh: [0, 1, 2, 3, 4].map((i) => {
      const y = 296 + i * 42
      return { label: label(236, y, 176, 40, 26), range: label(20, y, 216, 40, 28) }
    }),
    // always-on display
    aod: {
      hijri: label(16, 84, 400, 44, 30),
      time: label(0, 130, 432, 120, 112),
      greg: label(16, 248, 400, 36, 26),
      next: label(16, 292, 400, 44, 30),
    },
    // Edit slot over the clock digits (the widest time, e.g. 12:58, fits)
    editDigits: box(71, 94, 290, 96),
    tips: { w: Z(220), h: Z(40) }, // the focused slot's title label (edit/tips_bg.png); titles must fit
    menu: {
      rows: ROWS,
      bg: { x: 0, y: 0, w: width, h: height },
      title: label(48, 30, 336, 50, 28),
      titleTap: box(16, 30, 400, 50),
      back: box(384, 39, 18, 32), // ▶ in the right margin (arrow-back.png)
      up: box(200, 94, 32, 18), // ▲ (arrow-up.png)
      upTap: box(16, 82, 400, 42),
      down: box(200, DOWN_Y + 19, 32, 18), // ▼ (arrow-down.png)
      downTap: box(16, DOWN_Y, 400, 56),
      count: label(306, DOWN_Y, 110, 56, 22),
      row: [0, 1, 2, 3].map((i) => {
        const y = ROW_Y + i * ROW_H
        return {
          tap: box(16, y, 400, ROW_H),
          label: label(16, y, 400, ROW_H, 30), // list rows: full width
          side: label(SIDE_X, y, 432 - 16 - SIDE_X, ROW_H, 28), // rows with a value
          value: label(16, y, 200, ROW_H, 30),
        }
      }),
      // value screen: − and + at the sides of the value, fine steps underneath. The value is wide
      // enough for a longitude (-١٧٩.٩°, ~200 px at 52); the − and + glyphs are ~45 px.
      caption: label(16, 82, 400, 42, 24),
      value: label(96, 150, 240, 140, 52),
      minus: label(16, 150, 80, 140, 80),
      plus: label(336, 150, 80, 140, 80),
      fineMinus: label(16, 304, 192, 80, 34),
      finePlus: label(224, 304, 192, 80, 34),
      radius: Z(14), // pressed-row highlight
    },
  }
}
