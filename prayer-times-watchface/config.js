// Build-time settings. Method, Hijri offset / day start, digits, iqama and extra Fajr/Isha
// are chosen on the watch (long-press the face → Edit); their defaults are in tools/gen-edit-assets.py.
export const CONFIG = {
  // Fallback location until the Prayer Location app has published one (Cairo)
  lat: 30.0444,
  lon: 31.2357,
  // Extra minutes per prayer, on top of the method's own adjustments, to match a local calendar
  adjust: { fajr: 0, sunrise: 0, dhuhr: 0, asr: 0, maghrib: 0, isha: 0 },
  is24h: false,
  // Font for Arabic text: the bundled Naskh subset of SIL's Scheherazade New (tools/gen-font.py),
  // or null for the watch's system font.
  arabicFont: 'fonts/naskh.ttf',
  // Prohibited window after sunrise ends this many minutes after sunrise (10, 15 or 20);
  // Duha starts then too.
  sunriseWindowMin: 15,
  // Extra Fajr #1 / Isha #1 angles used by the "فجر مخصص" / "عشاء مخصص" (custom) edit options;
  // 0 = none. The watch also offers 18°–12° (incl. 14.6° for Fajr) directly.
  extraFajrAngle: 0,
  extraIshaAngle: 0,
  // Iqama minutes after adhan for the "إقامة مخصصة" (custom) edit option; 0 = none for that prayer.
  // The other presets are in tools/gen-edit-assets.py.
  iqama: [20, 15, 15, 10, 15], // [fajr, dhuhr, asr, maghrib, isha]
  // Friday Dhuhr (Jumu'ah) iqama minutes; 0 = no iqama countdown on Fridays
  iqamaJumuah: 0,
}
