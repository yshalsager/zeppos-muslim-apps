// Base units: metre, kilogram, litre, Celsius, metre/second, square metre, gram, km/L, pascal, joule.
export const INGREDIENTS = [
  ['flour', 120, 'Flour', 'دقيق'], ['sugar', 198, 'Sugar', 'سكر'], ['brown_sugar', 213, 'Brown sugar', 'سكر بني'],
  ['powdered_sugar', 113, 'Powdered sugar', 'سكر بودرة'], ['rice', 198, 'Rice (dry)', 'أرز جاف'],
  ['butter', 226, 'Butter', 'زبدة'], ['oil', 198, 'Oil', 'زيت'], ['honey', 336, 'Honey', 'عسل'],
  ['milk', 227, 'Milk', 'حليب'], ['water', 227, 'Water', 'ماء'], ['semolina', 163, 'Semolina', 'سميد'], ['cocoa', 84, 'Cocoa', 'كاكاو'],
]
// Gas mark, conventional Celsius, conventional Fahrenheit: rounded cooking equivalents, not exact thermometry.
export const GAS_MARKS = [[.25, 110, 225], [.5, 120, 250], [1, 140, 275], [2, 150, 300], [3, 160, 325], [4, 180, 350], [5, 190, 375], [6, 200, 400], [7, 220, 425], [8, 230, 450], [9, 240, 475]]
const group = (category, rows) => rows.map(([id, factor, en, ar]) => ({ id, category, factor, en, ar }))
export const UNITS = [
  ...group('length', [['m', 1, 'Metre', 'متر'], ['km', 1000, 'Kilometre', 'كيلومتر'], ['cm', .01, 'Centimetre', 'سنتيمتر'], ['mm', .001, 'Millimetre', 'مليمتر'], ['in', .0254, 'Inch', 'بوصة'], ['ft', .3048, 'Foot', 'قدم'], ['yd', .9144, 'Yard', 'ياردة'], ['mi', 1609.344, 'Mile', 'ميل إنجليزي']]),
  ...group('weight', [['kg', 1, 'Kilogram', 'كيلوجرام'], ['g', .001, 'Gram', 'جرام'], ['mg', .000001, 'Milligram', 'مليجرام'], ['lb', .45359237, 'Pound', 'باوند'], ['oz', .028349523125, 'Ounce', 'أونصة'], ['st', 6.35029318, 'Stone', 'ستون'], ['ratl', .44928, 'Egyptian ratl', 'رطل مصري'], ['oqqa', 1.248, 'Oqqa', 'أقة'], ['kantar', 44.928, 'Kantar', 'قنطار مصري']]),
  ...group('volume', [['L', 1, 'Litre', 'لتر'], ['ml', .001, 'Millilitre', 'مليلتر'], ['us_cup', .2365882365, 'US cup', 'كوب أمريكي'], ['metric_cup', .25, 'Metric cup', 'كوب متري'], ['imp_cup', .284130625, 'UK cup', 'كوب بريطاني'], ['us_pint', .473176473, 'US pint', 'باينت أمريكي'], ['imp_pint', .56826125, 'UK pint', 'باينت بريطاني'], ['us_floz', .0295735295625, 'US fluid oz', 'أونصة سائلة أمريكية'], ['imp_floz', .0284130625, 'UK fluid oz', 'أونصة سائلة بريطانية'], ['us_tsp', .00492892159375, 'US teaspoon', 'ملعقة شاي أمريكية'], ['us_tbsp', .01478676478125, 'US tablespoon', 'ملعقة طعام أمريكية'], ['tsp', .005, 'Metric/UK tsp', 'ملعقة شاي مترية'], ['tbsp', .015, 'Metric/UK tbsp', 'ملعقة طعام مترية'], ['ardeb', 198, 'Ardeb', 'أردب'], ['kila', 16.5, 'Kila', 'كيلة'], ['qadah', 2.0625, 'Qadah', 'قدح']]),
  ...group('temperature', [['C', 1, 'Celsius °C', 'مئوية °C'], ['F', 1, 'Fahrenheit °F', 'فهرنهايت °F'], ['K', 1, 'Kelvin K', 'كلفن K'], ['gas', 1, 'Gas mark', 'درجة فرن غاز']]),
  ...group('speed', [['mps', 1, 'Metres / sec', 'متر / ثانية'], ['kph', 1 / 3.6, 'km / hour', 'كم / ساعة'], ['mph', .44704, 'Miles / hour', 'ميل / ساعة'], ['knot', 1852 / 3600, 'Knots', 'عقدة'], ['pace_km', 1000 / 60, 'Minutes / km', 'دقائق / كم'], ['pace_mi', 1609.344 / 60, 'Minutes / mile', 'دقائق / ميل']]),
  ...group('area', [['sqm', 1, 'Square metre', 'متر مربع'], ['sqkm', 1e6, 'Square km', 'كيلومتر مربع'], ['sqft', .09290304, 'Square foot', 'قدم مربع'], ['sqyd', .83612736, 'Square yard', 'ياردة مربعة'], ['acre', 4046.8564224, 'Acre', 'أكر'], ['ha', 1e4, 'Hectare', 'هكتار'], ['feddan', 4200.83, 'Feddan', 'فدان'], ['qirat', 175.035, 'Qirat (land)', 'قيراط (أرض)'], ['sahm', 7.293, 'Sahm', 'سهم']]),
  ...group('gold_mass', [['ng', 1, 'Gram', 'جرام'], ['mithqal', 4.25, 'Mithqal', 'مثقال'], ['dinar', 4.25, 'Islamic dinar', 'الدينار الشرعي'], ['tola', 11.664, 'Tola', 'تولة'], ['gold', 85, 'Gold nisab', 'نصاب الذهب']]),
  ...group('silver_mass', [['sg', 1, 'Gram', 'جرام'], ['dirham', 2.975, 'Islamic dirham', 'الدرهم الشرعي'], ['uqiyah', 119, 'Uqiyah', 'أوقية شرعية'], ['silver_tola', 11.664, 'Tola', 'تولة'], ['silver', 595, 'Silver nisab', 'نصاب الفضة'], ['mahr', 1487.5, 'Sunnah mahr', 'مهر السنة']]),
  ...group('gold_mass', [24, 22, 21, 18, 14, 12, 9].map((karat) => [`gold_${karat}`, karat / 24, `Gram ${karat}k`, `جرام عيار ${karat}`])),
  ...group('fitr', [['fkg', 1, 'Kilogram', 'كيلوجرام'], ['sa', 2.5, "Saʿ", 'صاع'], ['mudd', .625, 'Mudd', 'مدّ'], ['wasq', 150, 'Wasq', 'وسق'], ['crops', 750, 'Crops nisab', 'نصاب الزروع'], ['fidya', .625, 'Fidya (1 day)', 'فدية يوم'], ['oath', 6.25, 'Oath kaffara', 'كفارة يمين'], ['fast', 37.5, 'Fast kaffara', 'كفارة صيام']]),
  ...group('ingredients', [['i_cup', 120, 'US cup', 'كوب أمريكي'], ['i_metric', 120 * 250 / 236.5882365, 'Metric cup', 'كوب متري'], ['i_tbsp', 7.5, 'US tbsp', 'ملعقة طعام'], ['i_tsp', 2.5, 'US tsp', 'ملعقة شاي'], ['i_g', 1, 'Gram', 'جرام'], ['i_oz', 28.349523125, 'Ounce', 'أونصة']]),
  ...group('fuel', [['kmL', 1, 'km / L', 'كم / لتر'], ['l100', 100, 'L / 100 km', 'لتر / 100 كم'], ['mpg_us', 1.609344 / 3.785411784, 'mpg (US)', 'ميل/جالون أمريكي'], ['mpg_uk', 1.609344 / 4.54609, 'mpg (UK)', 'ميل/جالون بريطاني']]),
  ...group('pressure', [['bar', 100000, 'Bar', 'بار'], ['psi', 6894.757293168, 'psi', 'باوند/بوصة مربعة'], ['kPa', 1000, 'kPa', 'كيلوباسكال'], ['atm', 101325, 'Atmosphere', 'ضغط جوي']]),
  ...group('energy', [['kcal', 4184, 'kcal', 'كيلوسعرة'], ['kJ', 1000, 'kJ', 'كيلوجول'], ['kWh', 3600000, 'kWh', 'كيلوواط ساعة']]),
  ...group('distance', [['dkm', 1000, 'Kilometre', 'كيلومتر'], ['dm', 1, 'Metre', 'متر'], ['dcm', .01, 'Centimetre', 'سنتيمتر'], ['dhira', .48, 'Dhiraʿ', 'ذراع'], ['mil', 1680, 'Mil (Islamic)', 'ميل شرعي'], ['farsakh', 5040, 'Farsakh', 'فرسخ'], ['barid', 20160, 'Barid', 'بريد'], ['qasr', 80640, 'Qasr distance', 'مسافة القصر']]),
]
export const CATEGORIES = ['length', 'weight', 'volume', 'ingredients', 'temperature', 'speed', 'area', 'fuel', 'pressure', 'energy', 'islamic']
export const PAIRS = { length: ['m', 'ft'], weight: ['kg', 'lb'], volume: ['us_cup', 'ml'], temperature: ['C', 'F'], speed: ['pace_km', 'pace_mi'], area: ['sqm', 'sqft'], ingredients: ['i_cup', 'i_g'], fuel: ['kmL', 'l100'], pressure: ['bar', 'psi'], energy: ['kcal', 'kJ'], gold_mass: ['gold_21', 'gold_24'], silver_mass: ['dirham', 'sg'], fitr: ['sa', 'fkg'], distance: ['qasr', 'dkm'] }
export const OPTIONS = {
  poor_person: [[.25, 'Majority · 1 mudd', 'الجمهور · مدّ'], [.5, 'Hanafi · half saʿ', 'حنفي · نصف صاع']],
  gold: [[85, 'Majority', 'الجمهور'], [87.48, 'Hanafi', 'حنفي']],
  silver: [[595, 'Majority', 'الجمهور'], [612.36, 'Hanafi', 'حنفي']],
  sa: [[2.5, 'Rice', 'أرز'], [2.04, 'Wheat', 'قمح'], [2.1, 'Rice', 'أرز'], [3, 'Precaution', 'احتياطًا'], [3.25, 'Hanafi (Egypt)', 'حنفي (مصر)'], [3.18, 'Hanafi (South Asia)', 'حنفي (جنوب آسيا)']],
  mil: [[1.68, '', ''], [1.85, '', ''], [1.92, '', '']],
  qasr: [[80.64, 'Majority', 'الجمهور'], [80, 'Majority', 'الجمهور'], [81, 'Hanafi', 'حنفي'], [88.8, 'Hanafi', 'حنفي'], [77, 'Hanafi (approx.)', 'حنفي (تقريبي)']],
}
export const DEFAULTS = { ...Object.fromEntries(Object.entries(OPTIONS).map(([k, v]) => [k, v[0][0]])), arabic_digits: false }
export const unit = (id) => UNITS.find((u) => u.id === id)
export const units = (category) => UNITS.filter((u) => u.category === category)
export function factor(id, settings = DEFAULTS, ingredient = 'flour') {
  const s = { ...DEFAULTS, ...settings }
  const cup = (INGREDIENTS.find(([key]) => key === ingredient) || INGREDIENTS[0])[1]
  return ({ i_cup: cup, i_metric: cup * 250 / 236.5882365, i_tbsp: cup / 16, i_tsp: cup / 48, wasq: s.sa * 60, crops: s.sa * 300, fidya: s.sa * s.poor_person, oath: s.sa * s.poor_person * 10, fast: s.sa * s.poor_person * 60, gold: s.gold, silver: s.silver, sa: s.sa, mudd: s.sa / 4, mil: s.mil * 1000, farsakh: s.mil * 3000, barid: s.mil * 12000, qasr: s.qasr * 1000 })[id] || unit(id).factor
}
export const pace = (id) => id === 'pace_km' || id === 'pace_mi'
const inverse = (id) => pace(id) || id === 'l100'
export function convert(value, from, to, settings = DEFAULTS, ingredient = 'flour') {
  const a = unit(from), b = unit(to)
  if (!a || !b || a.category !== b.category || !Number.isFinite(value)) return NaN
  if (a.category === 'temperature') {
    if (from === 'K' && value < 0 || from === 'C' && value < -273.15 || from === 'F' && value < -459.67) return NaN
    if (from === 'gas') {
      const row = GAS_MARKS.find(([mark]) => mark === value)
      return !row ? NaN : to === 'gas' ? value : to === 'F' ? row[2] : row[1] + (to === 'K' ? 273.15 : 0)
    }
    if (to === 'gas') {
      const column = from === 'F' ? 2 : 1
      const temperature = from === 'K' ? value - 273.15 : value
      if (temperature < GAS_MARKS[0][column] || temperature > GAS_MARKS[GAS_MARKS.length - 1][column]) return NaN
      return GAS_MARKS.reduce((best, row) => Math.abs(row[column] - temperature) <= Math.abs(best[column] - temperature) ? row : best)[0]
    }
    const c = from === 'F' ? (value - 32) * 5 / 9 : from === 'K' ? value - 273.15 : value
    return to === 'F' ? c * 9 / 5 + 32 : to === 'K' ? Math.max(c + 273.15, 0) : c
  }
  if (['speed', 'fuel'].includes(a.category) && (value < 0 || inverse(from) && value === 0)) return NaN
  const base = inverse(from) ? factor(from, settings, ingredient) / value : value * factor(from, settings, ingredient)
  if (!Number.isFinite(base) || base === 0 && value !== 0) return NaN
  const result = inverse(to) ? factor(to, settings, ingredient) / base : base / factor(to, settings, ingredient)
  return Number.isFinite(result) && (result !== 0 || value === 0) ? result : NaN
}
export function digits(value, arabic_digits = false) {
  const western = String(value).replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d)).replace(/٫/g, '.')
  return arabic_digits ? western.replace(/\d/g, (d) => '٠١٢٣٤٥٦٧٨٩'[d]).replace(/\./g, '٫') : western
}
export function decimal(value) {
  const [coefficient, exponent] = String(value).split('e')
  if (!exponent) return coefficient
  const negative = coefficient.startsWith('-')
  const unsigned = coefficient.replace('-', '')
  const point = (unsigned.indexOf('.') < 0 ? unsigned.length : unsigned.indexOf('.')) + Number(exponent)
  const numbers = unsigned.replace('.', '')
  return (negative ? '-' : '') + (point <= 0 ? '0.' + '0'.repeat(-point) + numbers : point >= numbers.length ? numbers + '0'.repeat(point - numbers.length) : numbers.slice(0, point) + '.' + numbers.slice(point))
}
export function format(value, arabic_digits = false, id) {
  if (!Number.isFinite(value)) return '—'
  if (pace(id)) {
    const seconds = Math.round(Math.abs(value) * 60)
    return digits(`${value < 0 ? '-' : ''}${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`, arabic_digits)
  }
  return digits(decimal(Number(value.toPrecision(6))), arabic_digits)
}
export function parsePace(value) {
  if (!/^\d+(?::\d{1,2})?$/.test(value)) return NaN
  const [minutes, seconds = '0'] = value.split(':')
  return Number(seconds) < 60 ? Number(minutes) + Number(seconds) / 60 : NaN
}
export function editNumber(value, key, separator = '.') {
  if (key === '⌫') return value.slice(0, -1) || '0'
  if (key === '+/-') return value.startsWith('-') ? value.slice(1) : value === '0' ? '-0' : '-' + value
  if (key === separator) return value.includes(separator) ? value : value + separator
  if (!/^\d$/.test(key) || value.replace(/[-.:]/g, '').length >= 12) return value
  return value === '0' ? key : value === '-0' ? '-' + key : value + key
}
