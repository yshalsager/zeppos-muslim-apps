// Build-time defaults. On the watch:
//  - tap the date line (face menu, lib/settings.js): location, method, Asr school, high latitudes, Hijri offset /
//    day start, iqama, extra Fajr/Isha, sunrise window, adjustments, 12/24h, language. The values below are
//    only their defaults.
//  - long-press the face → Edit: digits and the extras row (defaults in tools/gen-edit-assets.py)
export const CONFIG = {
  // Fallback location until a city is picked or the Prayer Location app publishes one (Cairo)
  lat: 30.0444,
  lon: 31.2357,
  country: 'EG', // its country, for the automatic method
  // Calculation method: 'auto' (by the location's country, lib/methods.js) or a lib/prayer.js METHODS key
  method: 'auto',
  // Far from the equator: how Fajr and Isha are capped when the sun stays near the horizon.
  // 'auto' (seventh of the night above 48°, middle below), 'middle', 'seventh' or 'twilight' (lib/prayer.js)
  highLatRule: 'auto',
  // Asr shadow: 1 = majority (Shafi'i, Maliki, Hanbali), 2 = Hanafi; also picks the prohibited-time preset
  asrFactor: 1,
  // Hijri date: days added to Umm al-Qura (-2…2), and whether the day starts at Maghrib
  hijriOffsetDays: 0,
  hijriDayStartsAtMaghrib: false,
  // Iqama minutes after adhan [fajr, dhuhr, asr, maghrib, isha]; 0 = no iqama countdown for that prayer
  iqama: [0, 0, 0, 0, 0],
  // Friday Dhuhr (Jumu'ah) iqama minutes; 0 = none
  iqamaJumuah: 0,
  // Extra Fajr / Isha at these sun angles (degrees, 12–20); 0 = none
  extraFajrAngle: 0,
  extraIshaAngle: 0,
  // Prohibited window after sunrise ends this many minutes after sunrise (10, 15 or 20);
  // Duha starts then too.
  sunriseWindowMin: 15,
  // Extra minutes per prayer, on top of the method's own adjustments, to match a local calendar
  adjust: { fajr: 0, sunrise: 0, dhuhr: 0, asr: 0, maghrib: 0, isha: 0 },
  // 'system' follows the watch's 12/24-hour setting; '12' or '24' overrides it
  clock: 'system',
  // 'auto' follows the watch's language (English when the face doesn't have it), or one of
  // lib/i18n/index.js LANGS: 'ar', 'en', 'fr', 'tr', 'id', 'ms', 'ru'
  language: 'auto',
  // Font for Arabic text: the bundled Naskh subset of SIL's Scheherazade New (tools/gen-font.py),
  // or null for the watch's system font.
  arabicFont: 'fonts/naskh.ttf',
}
