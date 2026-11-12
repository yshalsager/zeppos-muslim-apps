// What the countdown line shows, as plain data (shared by the face, the preview and the tests).
import { PRAYER_ORDER, nightPortions } from './prayer.js'

export const URGENT_MIN = 10 // last minutes before an adhan: countdown turns orange (iqama stays gold)

const PRAYERS = PRAYER_ORDER.filter((k) => k !== 'sunrise') // sunrise is shown but isn't a prayer

// t: today's events in minutes from local midnight. ctx: { yesterdayIsha, yesterdayMaghrib,
// tomorrowFajr } (minutes relative to today's midnight, so < 0 or > 1440), iqama(k) → minutes.
// Returns {
//   next,       prayer to highlight (the current one while waiting for its iqama)
//   iqama,      true between that prayer's adhan and its iqama
//   from, to,   the interval the progress bar spans (previous adhan → next adhan, or adhan → iqama)
//   left,       minutes until `to`
//   frac,       0..1 progress through the interval
//   urgent,     an adhan is at most URGENT_MIN away (not during iqama)
//   lastThird,  in the last third of the night (Fajr is next)
// }
export function countdown(t, nowMin, ctx) {
  for (const k of PRAYERS) {
    const iq = ctx.iqama ? ctx.iqama(k) : 0
    if (iq > 0 && nowMin >= t[k] && nowMin < t[k] + iq) {
      return finish({ next: k, iqama: true, from: t[k], to: t[k] + iq, lastThird: false }, nowMin)
    }
  }
  let from = ctx.yesterdayIsha
  let next = 'fajr'
  let to = ctx.tomorrowFajr
  for (const k of PRAYERS) {
    if (t[k] > nowMin) { next = k; to = t[k]; break }
    from = t[k]
  }
  let lastThird = false
  if (next === 'fajr') {
    // before today's Fajr the night is yesterday's Maghrib → today's Fajr; after Isha it's tonight's
    const night = nowMin < t.fajr ? nightPortions(ctx.yesterdayMaghrib, t.fajr) : nightPortions(t.maghrib, ctx.tomorrowFajr)
    lastThird = !!night && nowMin >= night.lastThird
  }
  return finish({ next, iqama: false, from, to, lastThird }, nowMin)
}

function finish(c, nowMin) {
  c.left = c.to - nowMin
  const span = c.to - c.from
  c.frac = span > 0 ? Math.min(1, Math.max(0, (nowMin - c.from) / span)) : 0
  c.urgent = !c.iqama && c.left <= URGENT_MIN
  return c
}
