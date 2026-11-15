// Every box the pages draw, for one screen. Rectangles: designed for the Bip Max (432 × 514, corner
// radius 106 px) and scaled, x by width, y by height, text by the smaller of the two. Round screens
// (width = height on Zepp OS): their own design at 480 × 480, scaled evenly, every box inside the
// circle and nothing tappable in the bottom ~60 px (the swipe-up gesture), as the watchface does.
// Used by page/*.js and, through tools/preview-data.mjs, by the preview images; test/layout.test.js
// checks every box fits inside each target's screen.
//
// rtl mirrors the rows that read in order (mode tabs, results, the alarm row); the time stepper
// stays hours:minutes.
export const DESIGN = { width: 432, height: 514 }
export const ROUND = 480

export function layout(width = DESIGN.width, height = DESIGN.height, rtl = false) {
  const D = width === height ? { width: ROUND, height: ROUND } : DESIGN
  const sx = width / D.width
  const sy = height / D.height
  const sz = Math.min(sx, sy)
  const Z = (v) => Math.round(v * sz)
  // design box (x, y, w, h, text size) → screen box, mirrored if asked
  const box = (x, y, w, h, size, mirror = false) => {
    const b = { x: Math.round((mirror && rtl ? D.width - x - w : x) * sx), y: Math.round(y * sy), w: Math.round(w * sx), h: Math.round(h * sy) }
    if (size) b.text_size = Z(size)
    return b
  }
  const button = (x, y, w, h, size) => ({ ...box(x, y, w, h, size), radius: Math.round(Math.min(w * sx, h * sy) / 2) })
  // an image: square, scaled with the text (tools/gen-icon.py draws it at this size)
  const image = (x, y, size, mirror = false) => {
    const s = Z(size)
    const b = box(x, y, size, size, 0, mirror)
    return { x: b.x + Math.round((b.w - s) / 2), y: b.y + Math.round((b.h - s) / 2), w: s, h: s }
  }
  const pages = (width === height ? roundPages : rectPages)({ box, button, image, Z })
  return { width, height, ...pages }
}

function rectPages({ box, button, image, Z }) {

  // Main page. Tabs start below the rounded corners; the 2 × 3 results grid fills the middle.
  const TAB_W = 116
  const tabs = [0, 1, 2].map((i) => ({ ...box(36 + i * (TAB_W + 6), 36, TAB_W, 52, 24, true), radius: Z(26) }))
  // stepper: [−] hours [+] : [−] minutes [+]
  const group = (x0) => ({ minus: button(x0, 108, 52, 52, 36), value: box(x0 + 52, 100, 88, 68, 56), plus: button(x0 + 140, 108, 52, 52, 36) })
  const cells = [0, 1, 2, 3, 4, 5].map((i) => {
    const x = 12 + (i % 2) * 208
    const y = 238 + Math.floor(i / 2) * 72
    return { cell: { ...box(x, y, 200, 66, 0, true), radius: Z(16) }, time: box(x, y + 2, 200, 40, 34, true), dur: box(x, y + 40, 200, 24, 20, true) }
  })
  const main = {
    tabs,
    hour: group(12),
    colon: box(204, 100, 24, 68, 56),
    minute: group(228),
    ampm: box(64, 168, 88, 26, 20),
    hint: box(36, 196, 360, 34, 22),
    cells,
    // bottom row: the Settings button; with an alarm set, the alarm chip (icon, time, time left; tap to
    // cancel) and a round gear button instead, mirrored for right to left
    settings: button(116, 460, 200, 44, 22),
    chip: { ...box(70, 460, 240, 44, 0, true), radius: Z(22) },
    chipIcon: image(80, 470, 24, true),
    chipText: box(108, 460, 196, 44, 20, true),
    gear: { ...image(318, 460, 44, true), radius: Z(22) },
  }

  // Settings page: 5 rows of label + [−] value [+], then the test-alarm button
  const rows = [0, 1, 2, 3, 4].map((i) => {
    const y = 40 + i * 72
    return { label: box(36, y, 360, 26, 20), minus: button(40, y + 28, 64, 44, 32), value: box(104, y + 28, 224, 44, 28), plus: button(328, y + 28, 64, 44, 32) }
  })
  const settings = { rows, test: button(66, 412, 300, 52, 22) }

  // Alarm page (confirm, result, cancel) and the bedtime reminder: a title, three lines, a button
  const alarm = {
    title: box(36, 76, 360, 64, 40),
    lines: [0, 1, 2].map((i) => box(36, 156 + i * 44, 360, 40, 24)),
    button: button(66, 380, 300, 72, 28),
    // confirm screen: Do Not Disturb warning and the system Alarm app (big when DND is known on)
    warn: box(36, 240, 360, 58, 22),
    alt: button(86, 306, 260, 56, 24),
    altSmall: button(116, 312, 200, 44, 20),
  }

  // Ring page: the time, "Wake up", Snooze and Stop
  const ring = {
    time: box(16, 60, 400, 120, 96),
    label: box(36, 186, 360, 56, 34),
    snooze: button(46, 270, 340, 88, 32),
    stop: button(46, 374, 340, 88, 32),
  }

  return { main, settings, alarm, ring }
}

// The round design at 480 × 480
function roundPages({ box, button, image, Z }) {
  const TAB_W = 90
  const tabs = [0, 1, 2].map((i) => ({ ...box(99 + i * (TAB_W + 6), 52, TAB_W, 42, 20, true), radius: Z(21) }))
  const group = (x0) => ({ minus: button(x0, 104, 44, 44, 32), value: box(x0 + 44, 100, 76, 52, 46), plus: button(x0 + 120, 104, 44, 44, 32) })
  const cells = [0, 1, 2, 3, 4, 5].map((i) => {
    const x = 68 + (i % 2) * 176
    const y = 200 + Math.floor(i / 2) * 56
    return { cell: { ...box(x, y, 168, 52, 0, true), radius: Z(14) }, time: box(x, y + 1, 168, 31, 26, true), dur: box(x, y + 31, 168, 19, 16, true) }
  })
  const main = {
    tabs,
    hour: group(66),
    colon: box(230, 100, 20, 52, 46),
    minute: group(250),
    ampm: box(110, 152, 76, 22, 16),
    hint: box(80, 174, 320, 24, 18),
    cells,
    settings: button(150, 376, 180, 42, 20),
    chip: { ...box(113, 376, 206, 42, 0, true), radius: Z(21) },
    chipIcon: image(121, 385, 24, true),
    chipText: box(149, 376, 166, 42, 18, true),
    gear: { ...image(325, 376, 42, true), radius: Z(21) },
  }
  const rows = [0, 1, 2, 3, 4].map((i) => {
    const y = 52 + i * 64
    return { label: box(120, y, 240, 22, 18), minus: button(80, y + 22, 56, 40, 30), value: box(136, y + 22, 208, 40, 24), plus: button(344, y + 22, 56, 40, 30) }
  })
  const settings = { rows, test: button(120, 376, 240, 42, 18) }
  const alarm = {
    title: box(90, 90, 300, 56, 36),
    lines: [0, 1, 2].map((i) => box(60, 152 + i * 40, 360, 36, 22)),
    button: button(110, 350, 260, 60, 26),
    warn: box(70, 232, 340, 52, 20),
    alt: button(120, 290, 240, 48, 22),
    altSmall: button(140, 296, 200, 40, 18),
  }
  const ring = {
    time: box(80, 70, 320, 100, 84),
    label: box(70, 172, 340, 44, 30),
    snooze: button(70, 228, 340, 76, 30),
    stop: button(90, 314, 300, 76, 30),
  }
  return { main, settings, alarm, ring }
}
