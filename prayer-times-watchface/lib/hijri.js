import { UQ_START_YEAR, UQ_START_EPOCH_DAY, UQ_MONTH_MASKS } from './hijri-table.js'

export const HIJRI_MONTHS_AR = [
  'محرم', 'صفر', 'ربيع الأول', 'ربيع الآخر', 'جمادى الأولى', 'جمادى الآخرة',
  'رجب', 'شعبان', 'رمضان', 'شوال', 'ذو القعدة', 'ذو الحجة',
]
export const WEEKDAYS_AR = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت']

// Days since 1970-01-01 for a proleptic Gregorian date (month 1-12).
export function epochDay(y, m, d) {
  return Math.floor(Date.UTC(y, m - 1, d) / 86400000)
}

// Tabular (arithmetic) Islamic calendar, used outside the Umm al-Qura table range.
function tabularFromEpochDay(ed) {
  const jd = ed + 2440588 // Julian Day Number
  const l0 = jd - 1948440 + 10632
  const n = Math.floor((l0 - 1) / 10631)
  const l1 = l0 - 10631 * n + 354
  const j = Math.floor((10985 - l1) / 5316) * Math.floor((50 * l1) / 17719) +
    Math.floor(l1 / 5670) * Math.floor((43 * l1) / 15238)
  const l2 = l1 - Math.floor((30 - j) / 15) * Math.floor((17719 * j) / 50) -
    Math.floor(j / 16) * Math.floor((15238 * j) / 43) + 29
  const month = Math.floor((24 * l2) / 709)
  const day = l2 - Math.floor((709 * month) / 24)
  const year = 30 * n + j - 30
  return { year, month, day }
}

// Converts an epoch day to Hijri {year, month (1-12), day}.
// Uses the Umm al-Qura table when in range; `offsetDays` shifts the result for
// local moon-sighting differences (e.g. -1 / +1).
export function hijriFromEpochDay(ed, offsetDays = 0) {
  let rem = ed + offsetDays - UQ_START_EPOCH_DAY
  if (rem >= 0) {
    for (let i = 0; i < UQ_MONTH_MASKS.length; i++) {
      const mask = UQ_MONTH_MASKS[i]
      for (let m = 0; m < 12; m++) {
        const len = (mask >> m) & 1 ? 30 : 29
        if (rem < len) return { year: UQ_START_YEAR + i, month: m + 1, day: rem + 1 }
        rem -= len
      }
    }
  }
  return tabularFromEpochDay(ed + offsetDays)
}
