// Arabic → English hints, so Arabic questions find the same English content (keyword search + filters).
// Meaning search already understands Arabic; these hints make keyword search and place filters work too.

const PLACES: Record<string, string[]> = {
  // Cities
  Dubai: ["دبي"], "Abu Dhabi": ["أبوظبي", "ابوظبي", "أبو ظبي", "ابو ظبي"], Sharjah: ["الشارقة"], AlUla: ["العلا"], Jeddah: ["جدة"],
  Riyadh: ["الرياض"], Abha: ["أبها", "ابها"], "Al Ahsa": ["الأحساء", "الاحساء"], Dammam: ["الدمام", "الظهران"], Doha: ["الدوحة"],
  Muscat: ["مسقط"], Salalah: ["صلالة"], Manama: ["المنامة"], "Kuwait City": ["مدينة الكويت"], Amman: ["عمّان"], Aqaba: ["العقبة"],
  Baku: ["باكو"], Ganja: ["كنجة", "گنجه"],
  Istanbul: ["إسطنبول", "اسطنبول"], Cappadocia: ["كابادوكيا", "كبادوكيا"], Antalya: ["أنطاليا", "انطاليا"], Bodrum: ["بودروم"],
  Pamukkale: ["باموكالي", "باموكاله"], Fethiye: ["فتحية"], Izmir: ["إزمير", "ازمير"], Trabzon: ["طرابزون"], Bursa: ["بورصة"],
  Marmaris: ["مرمريس"], Alanya: ["ألانيا", "الانيا"], Konya: ["قونية"], Ankara: ["أنقرة", "انقرة"],
  Kotor: ["كوتور"], Budva: ["بودفا"], Podgorica: ["بودغوريتشا", "بودجوريتسا"], Mostar: ["موستار"], Sarajevo: ["سراييفو"],
  Ohrid: ["أوهريد", "اوهريد"], Skopje: ["سكوبيه", "سكوبي"], Tetovo: ["تيتوفو"], Tirana: ["تيرانا"], Prizren: ["بريزرن"], Pristina: ["بريشتينا"],
  Marrakesh: ["مراكش"], Essaouira: ["الصويرة"], Tangier: ["طنجة"], Rabat: ["الرباط"], Casablanca: ["الدار البيضاء"],
  Cairo: ["القاهرة"], Alexandria: ["الإسكندرية", "الاسكندرية"], "Sharm El Sheikh": ["شرم الشيخ"], Hurghada: ["الغردقة"],
  Tunis: ["تونس العاصمة"], Djerba: ["جربة"], Sousse: ["سوسة"],
  Samarkand: ["سمرقند"], Bukhara: ["بخارى"], Tashkent: ["طشقند"], Khiva: ["خيوة"], Almaty: ["ألماتي", "الماتي"], Astana: ["أستانا", "استانا"],
  Turkistan: ["تركستان"], Shymkent: ["شيمكنت"], Bishkek: ["بيشكيك"], Dushanbe: ["دوشانبي", "دوشنبه"], Kazan: ["قازان"],
  Bali: ["بالي"], Yogyakarta: ["يوجياكارتا", "جوجاكرتا"], "Kuala Lumpur": ["كوالالمبور", "كوالا لمبور"], Penang: ["بينانغ"], Langkawi: ["لنكاوي"],
  Male: ["ماليه"], "Baa Atoll": ["جزيرة با"], Hunza: ["هونزا"], Skardu: ["سكردو"], Satun: ["ساتون"], "Koh Lanta": ["كوه لانتا"],
  Kozhikode: ["كوزيكود", "كاليكوت"], Lakshadweep: ["لاكشادويب"], Hyderabad: ["حيدر أباد", "حيدرآباد", "حيدر آباد"], Lucknow: ["لكناو", "لكهنؤ"],
  Zanzibar: ["زنجبار"], "Stone Town": ["ستون تاون"],
  // Countries
  UAE: ["الإمارات", "الامارات"], "Saudi Arabia": ["السعودية"], Qatar: ["قطر"], Oman: ["سلطنة عمان", "عُمان"], Bahrain: ["البحرين"],
  Kuwait: ["الكويت"], Jordan: ["الأردن", "الاردن"], Azerbaijan: ["أذربيجان", "اذربيجان"], Türkiye: ["تركيا"],
  Montenegro: ["الجبل الأسود"], Bosnia: ["البوسنة"], "North Macedonia": ["مقدونيا"], Albania: ["ألبانيا", "البانيا"], Kosovo: ["كوسوفو"],
  Morocco: ["المغرب"], Egypt: ["مصر"], Tunisia: ["تونس"], Uzbekistan: ["أوزبكستان", "اوزبكستان"], Kazakhstan: ["كازاخستان"],
  Kyrgyzstan: ["قيرغيزستان"], Tajikistan: ["طاجيكستان"], Russia: ["روسيا"], Indonesia: ["إندونيسيا", "اندونيسيا"], Malaysia: ["ماليزيا"],
  Maldives: ["المالديف", "جزر المالديف"], Pakistan: ["باكستان"], Thailand: ["تايلاند"], India: ["الهند"], Tanzania: ["تنزانيا"],
  // Regions
  "Middle East and Gulf": ["الشرق الأوسط", "الخليج"], Balkans: ["البلقان"], "North Africa": ["شمال أفريقيا", "شمال افريقيا"],
  "Central Asia": ["آسيا الوسطى", "اسيا الوسطى"], "Southeast and South Asia": ["جنوب شرق آسيا", "جنوب آسيا"], "East Africa": ["شرق أفريقيا"],
};

const TOPICS: Record<string, string[]> = {
  "study university education student": ["جامعة", "جامعات", "دراسة", "أدرس", "ادرس", "طالب", "طلاب", "تعليم", "ماجستير", "دكتوراه", "الطب"],
  "travel trip city": ["سفر", "السفر", "أسافر", "اسافر", "رحلة", "سياحة", "وجهة", "وجهات", "مدن", "المدن"],
  "halal food": ["حلال", "طعام", "أكل", "اكل", "مطاعم"],
  "calm quiet peaceful": ["هادئ", "هادئة", "هدوء", "سلام", "سكينة"],
  "sea beach": ["البحر", "بحر", "شاطئ", "شواطئ"],
  "mosque masjid": ["مسجد", "مساجد", "جامع"],
  "history historic heritage": ["تاريخ", "تاريخية", "تاريخي", "تراث"],
  "things to do": ["ماذا أفعل", "ماذا افعل", "أنشطة", "انشطة", "أماكن", "اماكن"],
  "family children": ["عائلة", "العائلة", "أطفال", "اطفال"],
  "shopping market souk": ["تسوق", "سوق", "أسواق", "اسواق"],
};

/** English words to add to an Arabic question. Empty for English questions. */
export function arabicHints(q: string): string {
  if (!/[؀-ۿ]/.test(q)) return "";
  const out: string[] = [];
  for (const [en, ars] of Object.entries(PLACES)) if (ars.some((a) => q.includes(a))) out.push(en);
  for (const [en, ars] of Object.entries(TOPICS)) if (ars.some((a) => q.includes(a))) out.push(en);
  return out.join(" ");
}
