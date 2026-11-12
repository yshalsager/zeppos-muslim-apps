// Extras row: health/battery sensors and today's weather condition.
// Current temperature is drawn by the firmware (TEXT_IMG + data_type.WEATHER_CURRENT, see
// watchface/index.js) because watchface JS can only read the daily forecast, not the live value.
import { Battery, Step, HeartRate, Calorie } from '@zos/sensor'

// Short Arabic labels for the weather condition index (Zepp weather docs, 0–28); '' = unknown.
export const WEATHER_AR = [
  'غائم', 'زخات', 'ثلج', 'مشمس', 'ملبد', 'رذاذ', 'ثلج', 'مطر', 'ثلج', 'ثلوج',
  'أمطار', 'رمال', 'مطر وثلج', 'ضباب', 'شبورة', 'رعد', 'عاصفة', 'غبار', 'أمطار', 'برد',
  'رعد وبرد', 'أمطار', 'غبار', 'رمال', 'عاصفة', '', 'غائم', 'زخات', 'صاف',
]

// Today's forecast item { high, low, index } from the watchface weather sensor, or null when the
// phone hasn't sent weather (e.g. Gadgetbridge without a weather provider).
export function forecastToday() {
  try {
    // The legacy global is the watchface weather API; the @zos/sensor Weather class is deprecated
    // for apps and returns undefined there.
    if (typeof hmSensor === 'undefined') return null
    const wx = hmSensor.createSensor(hmSensor.id.WEATHER).getForecastWeather()
    const fd = wx && wx.forecastData
    return fd && fd.count > 0 && fd.data[0] ? fd.data[0] : null
  } catch (e) {
    console.log('forecastToday failed: ' + e)
    return null
  }
}

const makers = { steps: () => new Step(), heart: () => new HeartRate(), battery: () => new Battery(), flame: () => new Calorie() }

// Creates only the sensors the chosen extras need. Returns { read(kind) → number|null }.
export function makeSensors(kinds) {
  const s = {}
  for (const k of kinds) {
    if (makers[k] && !s[k]) {
      try { s[k] = makers[k]() } catch (e) { console.log(`sensor ${k} failed: ${e}`) }
    }
  }
  return {
    read(kind) {
      const sensor = s[kind]
      if (!sensor) return null
      try {
        const v = kind === 'heart' ? sensor.getLast() : sensor.getCurrent()
        return typeof v === 'number' && v > 0 ? v : null // 0 = no reading yet (e.g. heart rate)
      } catch (e) {
        return null
      }
    },
  }
}
