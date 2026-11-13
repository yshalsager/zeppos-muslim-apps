// Extras row: health/battery sensors and today's weather condition.
// Current temperature is drawn by the firmware (TEXT_IMG + data_type.WEATHER_CURRENT, see
// watchface/index.js) because watchface JS can only read the daily forecast, not the live value.
import { Battery, Step, HeartRate, Calorie } from '@zos/sensor'

const FORECAST_TTL_MS = 30 * 60 * 1000
let weather = null // sensor, created once
let forecast = { at: 0, day: '', item: null }

// Today's forecast item { high, low, index } from the watchface weather sensor, or null when the
// phone hasn't sent weather (e.g. Gadgetbridge without a weather provider). Runs on every wake,
// so the result is reused for FORECAST_TTL_MS unless the day changed.
export function forecastToday(day) {
  const now = Date.now()
  if (forecast.day === day && now - forecast.at < FORECAST_TTL_MS) return forecast.item
  let item = null
  try {
    // The legacy global is the watchface weather API; the @zos/sensor Weather class is deprecated
    // for apps and returns undefined there.
    if (typeof hmSensor !== 'undefined') {
      weather = weather || hmSensor.createSensor(hmSensor.id.WEATHER)
      const wx = weather.getForecastWeather()
      const fd = wx && wx.forecastData
      item = fd && fd.count > 0 && fd.data[0] ? fd.data[0] : null
    }
  } catch (e) {
    console.log('forecastToday failed: ' + e)
  }
  forecast = { at: now, day, item }
  return item
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
