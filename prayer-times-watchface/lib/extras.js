// Extras row: health and battery sensors. Weather (condition icon and temperature) is drawn by the
// firmware (IMG_LEVEL + data_type.WEATHER, TEXT_IMG + WEATHER_CURRENT; see watchface/index.js).
import { Battery, Step, HeartRate, Calorie } from '@zos/sensor'

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
