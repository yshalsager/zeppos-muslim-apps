// Screen geometry shared by the keyboard and the setup page. Pure, so Node tests can run it.

// Every round Zepp OS screen is square in pixels, and no rectangular one is.
export const isRound = (W, H) => W === H

// The widest strip that fits on the screen between heights y0 and y1, less margin on each side.
// On a circle that's the chord at whichever edge is farther from the centre.
export function span(W, H, y0, y1, margin) {
  if (!isRound(W, H)) return { x: margin, w: W - 2 * margin }
  const r = W / 2
  const d = Math.max(Math.abs(y0 - r), Math.abs(y1 - r))
  const x = Math.ceil(r - Math.sqrt(Math.max(r * r - d * d, 0))) + margin
  return { x, w: Math.max(W - 2 * x, 0) }
}

// Splits a strip into cells by weight, on a whole-pixel unit, centred: [{ x, w }].
export function cells(strip, weights) {
  const total = weights.reduce((a, b) => a + b, 0)
  const unit = Math.floor(strip.w / total)
  let x = strip.x + Math.floor((strip.w - unit * total) / 2)
  return weights.map((wt) => {
    const cell = { x, w: Math.round(unit * wt) }
    x += cell.w
    return cell
  })
}

// Rows of keys between top and bottom: [[{ x, y, w, h }]] in screen coordinates, gaps excluded.
export function grid(W, H, top, bottom, rows, margin) {
  const rowH = Math.floor((bottom - top) / rows.length)
  return rows.map((weights, r) => {
    const y = top + r * rowH
    return cells(span(W, H, y, y + rowH, margin), weights).map(({ x, w }) => ({ x: x + 2, y: y + 2, w: w - 4, h: rowH - 4 }))
  })
}

// The index of the widest of n rows between top and bottom (the one nearest a circle's middle).
export function widestRow(W, H, top, bottom, n) {
  const rowH = Math.floor((bottom - top) / n)
  let best = 0
  for (let r = 1; r < n; r++) {
    if (span(W, H, top + r * rowH, top + (r + 1) * rowH, 0).w > span(W, H, top + best * rowH, top + (best + 1) * rowH, 0).w) best = r
  }
  return best
}
