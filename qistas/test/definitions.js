// Independent reference data from the sourced definitions in README, not generated from lib/units.
export const exact = {
  m: 1, km: 1000, cm: .01, mm: .001, in: .0254, ft: .3048, yd: .9144, mi: 1609.344,
  kg: 1, g: .001, mg: .000001, lb: .45359237, oz: .028349523125, st: 6.35029318, ratl: .44928, oqqa: 1.248, kantar: 44.928,
  L: 1, ml: .001, us_cup: .2365882365, metric_cup: .25, imp_cup: .284130625, us_pint: .473176473, imp_pint: .56826125,
  us_floz: .0295735295625, imp_floz: .0284130625, us_tsp: .00492892159375, us_tbsp: .01478676478125, tsp: .005, tbsp: .015,
  ardeb: 198, kila: 16.5, qadah: 2.0625,
  i_cup: 120, i_metric: 120 * 250 / 236.5882365, i_tbsp: 7.5, i_tsp: 2.5, i_g: 1, i_oz: 28.349523125,
  kmL: 1, l100: 100, mpg_us: 1.609344 / 3.785411784, mpg_uk: 1.609344 / 4.54609,
  bar: 100000, psi: 4.4482216152605 / .0254 ** 2, kPa: 1000, atm: 101325, kcal: 4184, kJ: 1000, kWh: 3600000,
  uqiyah: 119, mahr: 1487.5, wasq: 150, crops: 750, fidya: .625, oath: 6.25, fast: 37.5,
  C: 1, F: 1, K: 1, gas: 1, mps: 1, kph: 1 / 3.6, mph: .44704, knot: 1852 / 3600, pace_km: 1000 / 60, pace_mi: 1609.344 / 60,
  sqm: 1, sqkm: 1e6, sqft: .09290304, sqyd: .83612736, acre: 4046.8564224, ha: 1e4, feddan: 4200.83, qirat: 175.035, sahm: 7.293,
  ng: 1, sg: 1, mithqal: 4.25, dinar: 4.25, dirham: 2.975, tola: 11.664, silver_tola: 11.664, gold: 85, silver: 595,
  gold_24: 1, gold_22: 22 / 24, gold_21: 21 / 24, gold_18: 18 / 24, gold_14: 14 / 24, gold_12: 12 / 24, gold_9: 9 / 24,
  fkg: 1, sa: 2.5, mudd: .625, dkm: 1000, dm: 1, dcm: .01, dhira: .48, mil: 1680, farsakh: 5040, barid: 20160, qasr: 80640,
}
export const quantities = {
  length: 'm km cm mm in ft yd mi',
  weight: 'kg g mg lb oz st ratl oqqa kantar',
  volume: 'L ml us_cup metric_cup imp_cup us_pint imp_pint us_floz imp_floz us_tsp us_tbsp tsp tbsp ardeb kila qadah',
  temperature: 'C F K gas',
  speed: 'mps kph mph knot pace_km pace_mi',
  area: 'sqm sqkm sqft sqyd acre ha feddan qirat sahm',
  gold_mass: 'ng mithqal dinar tola gold gold_24 gold_22 gold_21 gold_18 gold_14 gold_12 gold_9',
  silver_mass: 'sg dirham uqiyah silver_tola silver mahr',
  fitr: 'fkg sa mudd wasq crops fidya oath fast',
  ingredients: 'i_cup i_metric i_tbsp i_tsp i_g i_oz',
  fuel: 'kmL l100 mpg_us mpg_uk', pressure: 'bar psi kPa atm', energy: 'kcal kJ kWh',
  distance: 'dkm dm dcm dhira mil farsakh barid qasr',
}
export const ingredient_weights = { flour: 120, sugar: 198, brown_sugar: 213, powdered_sugar: 113, rice: 198, butter: 226, oil: 198, honey: 336, milk: 227, water: 227, semolina: 163, cocoa: 84 }
export const gas_table = [[.25, 110, 225], [.5, 120, 250], [1, 140, 275], [2, 150, 300], [3, 160, 325], [4, 180, 350], [5, 190, 375], [6, 200, 400], [7, 220, 425], [8, 230, 450], [9, 240, 475]]
