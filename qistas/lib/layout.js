// Fixed screens keep taps inside the circle; list rows use taller native scrolling content.
export function layout(width = 432, height = 514, rtl = false) {
  const round = width === height
  const sx = width / 360, sy = height / (round ? 360 : 428), sz = Math.min(sx, sy)
  const box = (x, y, w, h, size = 20, mirror = false) => ({ x: Math.round((mirror && rtl ? 360 - x - w : x) * sx), y: Math.round(y * sy), w: Math.round(w * sx), h: Math.round(h * sy), text_size: Math.round(size * sz), radius: Math.round(12 * sz) })
  const lower = (y) => y + (round ? 0 : 32)
  return {
    width, height, round,
    title: box(90, round ? 32 : 30, 180, 28, 22),
    row: (i) => round ? box(60, 76 + 66 * i, 240, 60, 18) : box(28, 90 + 86 * i, 304, 76, 21),
    value: box(70, 74, 220, 48, 38), from: box(86, 128, 188, 40, 20),
    swap: box(150, lower(176), 60, 40, 26), favourite: box(238, lower(176), 42, 40, 28, true),
    ingredient: box(42, lower(176), 150, 40, 17, true), ingredientSwap: box(204, lower(176), 60, 40, 26, true), ingredientStar: box(276, lower(176), 42, 40, 28, true),
    result: box(62, lower(222), 236, 48, 36), to: box(86, lower(274), 188, 40, 20),
    note: box(100, round ? 320 : 386, 160, 18, 13),
    input: box(74, 64, 212, 38, 30),
    keys: ['7', '8', '9', '4', '5', '6', '1', '2', '3', '+/-', '0', '.', '⌫', 'OK'].map((key, i) => ({ key, ...(i < 12 ? box(82 + i % 3 * 68, lower(108 + Math.floor(i / 3) * 42), 60, 38, 24) : box(104 + (i - 12) * 82, lower(276), 70, 38, 22)) })),
  }
}
