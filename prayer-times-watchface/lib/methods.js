// Calculation methods as the face menu shows them, and the automatic choice by country.
// Keys are lib/prayer.js METHODS (test/verify.mjs checks they match).

// Menu order; the names are in lib/i18n (methods)
export const METHOD_KEYS = [
  'egypt', 'makkah', 'mwl', 'karachi', 'isna', 'dubai', 'kuwait', 'qatar',
  'singapore', 'turkey', 'tehran', 'uiof', 'moonsighting',
]

// The method each country's mosques or official calendar commonly use (ISO 3166 codes, as in the
// city files). Anywhere else: Muslim World League, the usual default for Europe and the Far East.
const BY_COUNTRY = {
  egypt: 'EG SD SS LY SY LB IQ JO PS',
  makkah: 'SA YE BH OM',
  dubai: 'AE',
  kuwait: 'KW',
  qatar: 'QA',
  karachi: 'PK IN BD AF',
  singapore: 'SG MY BN ID',
  turkey: 'TR',
  tehran: 'IR',
  isna: 'US CA',
  uiof: 'FR',
  moonsighting: 'GB',
}
const COUNTRY_METHOD = {}
for (const k in BY_COUNTRY) for (const cc of BY_COUNTRY[k].split(' ')) COUNTRY_METHOD[cc] = k

export const autoMethod = (cc) => COUNTRY_METHOD[cc] || 'mwl'
