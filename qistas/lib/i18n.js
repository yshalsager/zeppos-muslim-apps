export const langOf = (id) => id === 13 || /^ar(?:-|$)/i.test(String(id)) ? 'ar' : 'en'
export const STRINGS = {
  en: {
    title: 'Qistas', favourites: 'Favourites', recents: 'Recent', to: 'to', clear: 'Clear', categories: 'Categories', empty: 'Use the star to save a pair',
    length: 'Length', weight: 'Weight', volume: 'Cooking volume', temperature: 'Temperature', speed: 'Speed & pace', area: 'Area', islamic: 'Islamic measures',
    ingredients: 'Ingredients', fuel: 'Fuel', pressure: 'Pressure', energy: 'Energy', ingredient: 'Ingredient',
    poor_person: 'Food per poor person', poor_title: 'Food per person',
    gold_mass: 'Gold', silver_mass: 'Silver', fitr: 'Saʿ & mudd', distance: 'Islamic distances', settings: 'Settings',
    gold: 'Gold nisab · g', silver: 'Silver nisab · g', sa: 'Saʿ · kg', mil: 'Mil · km', qasr: 'Qasr · km',
    arabic_digits: 'Arabic-Indic digits', on: 'On', off: 'Off',
    ok: 'OK', input: 'Enter value', invalid: 'Outside valid range', choose: 'Choose unit',
    grain: 'Mass varies with grain', selected: 'Selected', seconds: 'Seconds: 0–59',
    note: 'Estimates, not a fatwa', edit: 'Tap value to edit',
  },
  ar: {
    title: 'قسطاس', favourites: 'المفضلة', recents: 'الأخيرة', to: 'إلى', clear: 'مسح', categories: 'الفئات', empty: 'اضغط النجمة لحفظ التحويل',
    length: 'الطول', weight: 'الوزن', volume: 'مقادير الطبخ', temperature: 'الحرارة', speed: 'السرعة والوتيرة', area: 'المساحة', islamic: 'المقادير الشرعية',
    ingredients: 'المكونات', fuel: 'الوقود', pressure: 'الضغط', energy: 'الطاقة', ingredient: 'المكوّن',
    poor_person: 'طعام المسكين', poor_title: 'طعام المسكين',
    gold_mass: 'الذهب', silver_mass: 'الفضة', fitr: 'الصاع والمدّ', distance: 'المسافات الشرعية', settings: 'الإعدادات',
    gold: 'نصاب الذهب · جرام', silver: 'نصاب الفضة · جرام', sa: 'الصاع · كجم', mil: 'الميل · كم', qasr: 'القصر · كم',
    arabic_digits: 'أرقام هندية (١٢٣)', on: 'مفعّلة', off: 'معطّلة',
    ok: 'تم', input: 'أدخل القيمة', invalid: 'خارج النطاق الصحيح', choose: 'اختر الوحدة',
    grain: 'الوزن يختلف باختلاف الحب', selected: 'المختار', seconds: 'الثواني من 0 إلى 59',
    note: 'تقديرات وليست فتوى', edit: 'اضغط القيمة لتعديلها',
  },
}
export const localized = (en, ar, lang) => lang === 'ar' ? ar : en
