// Arabic: the reference language. Every language file has exactly these keys (test/verify.mjs).
// Functions take strings whose digits are already formatted, so word order is the language's own.
export default {
  name: 'العربية',
  rtl: true, // mirrors the face's layout and uses the bundled Naskh font
  prayers: { fajr: 'الفجر', sunrise: 'الشروق', dhuhr: 'الظهر', asr: 'العصر', maghrib: 'المغرب', isha: 'العشاء' },
  jumuah: 'الجمعة',
  hijriMonths: [
    'محرم', 'صفر', 'ربيع الأول', 'ربيع الآخر', 'جمادى الأولى', 'جمادى الآخرة',
    'رجب', 'شعبان', 'رمضان', 'شوال', 'ذو القعدة', 'ذو الحجة',
  ],
  months: ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'],
  weekdays: ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'], // Sunday first
  // { d, y }: formatted numbers; mon: month name; m: formatted month number; wd: weekday
  hijriDate: (p) => `${p.d} ${p.mon} ${p.y} هـ`,
  date: (p) => `${p.wd}  ${p.d}/${p.m}/${p.y}`,
  dateShort: (p) => `${p.wd}  ${p.d}/${p.m}`, // without the year: the date line when a place follows it
  nextIn: (prayer, left) => `${prayer} بعد ${left}`,
  iqamaIn: (prayer, left) => `إقامة ${prayer} بعد ${left}`,
  minutes: (n) => `${n} د`,
  lastThird: 'الثلث الأخير',
  pageNight: 'الليل والنوافل',
  pageMakruh: 'أوقات النهي',
  night: { firstThird: 'الثلث الأول', midpoint: 'منتصف الليل', lastThird: 'الثلث الأخير', lastSixth: 'السدس الأخير' },
  duha: 'الضحى',
  eid: { fitr: 'صلاة عيد الفطر', adha: 'صلاة عيد الأضحى' },
  eidEnd: 'نهاية وقت العيد',
  makruh: { dawn: 'من الفجر', sunrise: 'الشروق', zawal: 'الاستواء', afterAsr: 'بعد العصر', sunset: 'الغروب' },
  fallbackPlace: 'القاهرة', // config.js's fallback location
  fromApp: 'التطبيق', // place shown when the companion app's location is used
  coords: (lat, lon) => `${lat}،${lon}`, // typed-in coordinates on the date line; numbers already formatted
  methods: {
    egypt: 'الهيئة المصرية', makkah: 'أم القرى', mwl: 'رابطة العالم', karachi: 'كراتشي',
    isna: 'أمريكا الشمالية', dubai: 'دبي', kuwait: 'الكويت', qatar: 'قطر', singapore: 'سنغافورة',
    turkey: 'تركيا (ديانت)', tehran: 'طهران', uiof: 'اتحاد فرنسا', moonsighting: 'لجنة الأهلة',
  },
  // Edit-slot titles (long-press → Edit), drawn by the watch in its system font
  edit: {
    arabicDigits: 'أرقام عربية', latinDigits: 'أرقام لاتينية',
    weather: 'الطقس', steps: 'الخطوات', heart: 'النبض', battery: 'البطارية', flame: 'السعرات', none: 'بدون',
  },
  menu: {
    settings: 'الإعدادات',
    location: 'الموقع',
    locationFromApp: 'الموقع من التطبيق',
    coords: 'إحداثيات',
    latitude: 'خط العرض',
    longitude: 'خط الطول',
    useCoords: 'استخدام هذه الإحداثيات',
    method: 'طريقة الحساب',
    auto: 'تلقائي',
    hijri: 'التاريخ الهجري',
    hijriDefault: 'أم القرى',
    hijriOffset: 'تعديل (أيام)',
    dayStart: 'بداية اليوم',
    atMaghrib: 'المغرب',
    atMidnight: 'منتصف الليل',
    iqama: 'الإقامة',
    iqamaTitle: 'الإقامة بعد الأذان',
    preset: 'قالب',
    custom: 'مخصصة',
    presets: ['بدون إقامة', 'قصيرة', 'معتادة', 'طويلة'], // lib/settings.js IQAMA_PRESETS
    asr: 'العصر',
    asrMajority: 'الجمهور',
    asrHanafi: 'الحنفي',
    highLat: 'خطوط العرض العليا',
    highLatRules: { middle: 'منتصف الليل', seventh: 'سُبع الليل', twilight: 'زاوية الشفق' },
    extras: 'أوقات إضافية',
    extraFajr: 'فجر إضافي',
    extraIsha: 'عشاء إضافي',
    ishaBy: 'العشاء حسب',
    byAngle: 'الزاوية',
    byMinutes: 'الدقائق',
    sunriseWindow: 'نافذة الشروق',
    adjust: 'تعديل الأوقات',
    adjustTitle: 'تعديل الأوقات (دقائق)',
    clock: 'نظام الساعة',
    language: 'اللغة',
    off: 'بدون',
    cantSave: 'تعذر الحفظ',
    cantReadCities: 'تعذر قراءة المدن',
    groups: {
      arab: 'الدول العربية', AS: 'آسيا', AF: 'أفريقيا', EU: 'أوروبا',
      NA: 'أمريكا الشمالية', SA: 'أمريكا الجنوبية', OC: 'أوقيانوسيا',
    },
  },
}
