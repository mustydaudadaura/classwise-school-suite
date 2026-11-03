export type IslamiyyaAssessment = {
  id: string; ca1: number | null; ca2: number | null; exam: number | null;
  total: number | null; grade: string | null; remark: string | null;
  subject_position?: number | string | null;
  subjects: { name: string; code: string | null } | null;
};

export type IslamiyyaProgress = {
  id: string; record_date: string; surah_from: string; ayah_from: number;
  surah_to: string; ayah_to: number; assessment_type: string;
  score: number | null; grade: string | null; remarks: string | null;
};

const translations: Record<string, string> = {
  'first term': 'الفصل الدراسي الأول', first: 'الفصل الدراسي الأول',
  'second term': 'الفصل الدراسي الثاني', second: 'الفصل الدراسي الثاني',
  'third term': 'الفصل الدراسي الثالث', third: 'الفصل الدراسي الثالث',
  memorization: 'الحفظ', tajweed: 'التجويد', revision: 'المراجعة',
  'quran': 'القرآن الكريم', 'qur’an': 'القرآن الكريم', 'qur\'an': 'القرآن الكريم',
  'quran recitation': 'تلاوة القرآن الكريم', 'arabic': 'اللغة العربية', 'arabic language': 'اللغة العربية',
  'islamic studies': 'الدراسات الإسلامية', 'islamiyya': 'الدراسات الإسلامية',
  'tahfiz': 'حفظ القرآن الكريم', 'tahfeez': 'حفظ القرآن الكريم', 'hifz': 'الحفظ',
  'fiqh': 'الفقه', 'aqeedah': 'العقيدة', 'aqidah': 'العقيدة', 'hadith': 'الحديث',
  'seerah': 'السيرة النبوية', 'sirah': 'السيرة النبوية', 'adab': 'الآداب', 'akhlaq': 'الأخلاق',
  'duas': 'الأدعية', 'dua': 'الدعاء', 'excellent': 'ممتاز', 'distinction': 'ممتاز',
  'very good': 'جيد جداً', 'good': 'جيد', 'pass': 'مقبول', 'fail': 'راسب',
};

// Preserve unrecognised school-entered content rather than inventing a translation.
export function arabicReportText(value: string | null | undefined) {
  if (!value?.trim()) return '—';
  return translations[value.trim().toLowerCase()] ?? value;
}

export function arabicNumber(value: number | string | null | undefined) {
  if (value == null || value === '') return '—';
  const n = Number(value);
  return Number.isFinite(n) ? new Intl.NumberFormat('ar-EG', { maximumFractionDigits: 2 }).format(n) : value;
}

export function islamiyyaTotals(assessments: IslamiyyaAssessment[]) {
  const scored = assessments.filter(a => a.total != null && Number.isFinite(Number(a.total)));
  const total = scored.reduce((sum, a) => sum + Number(a.total), 0);
  return { total: scored.length ? total : null, average: scored.length ? total / scored.length : null };
}
export type ReportLanguage = 'ar' | 'ha' | 'ar_ha';

const hausaTranslations: Record<string, string> = {
  'first term': 'Zangon Farko', first: 'Zangon Farko',
  'second term': 'Zango na Biyu', second: 'Zango na Biyu',
  'third term': 'Zango na Uku', third: 'Zango na Uku',
  memorization: 'Haddar', tajweed: 'Tajwidi', revision: 'Bitarwa',
  excellent: 'Kyakkyawa ƙwarai', distinction: 'Kyakkyawa ƙwarai', 'very good': 'Mai kyau sosai',
  good: 'Mai kyau', credit: 'Matsakaici', pass: 'Ya wuce', fail: 'Bai wuce ba',
};

/** Hausa labels for terms and common remarks; school-entered text is kept as written. */
export function hausaReportText(value: string | null | undefined) {
  if (!value?.trim()) return '—';
  return hausaTranslations[value.trim().toLowerCase()] ?? value;
}

export function plainNumber(value: number | string | null | undefined) {
  if (value == null || value === '') return '—';
  const n = Number(value);
  return Number.isFinite(n) ? new Intl.NumberFormat('en-NG', { maximumFractionDigits: 2 }).format(n) : value;
}

export const REPORT_LABELS = {
  ar: {
    bismillah: 'بسم الله الرحمن الرحيم', fallbackSchool: 'المدرسة الإسلامية', title: 'بطاقة النتائج والتقدم الدراسي', photo: 'صورة الطالب', logo: 'شعار المدرسة',
    name: 'اسم الطالب', admission: 'رقم القيد', klass: 'الصف', session: 'العام الدراسي', term: 'الفصل الدراسي',
    results: 'نتائج المواد الدراسية', subject: 'المادة', ca: 'التقييم المستمر', exam: 'الامتحان', total: 'المجموع', grade: 'التقدير', position: 'الترتيب', remarks: 'الملاحظات',
    noResults: 'لم تُسجَّل نتائج المواد لهذا الفصل', average: 'المعدل', classPosition: 'الترتيب في الصف',
    quran: 'متابعة حفظ القرآن الكريم والتجويد والمراجعة', date: 'التاريخ', from: 'من سورة / آية', to: 'إلى سورة / آية', assessment: 'التقييم', score: 'الدرجة',
    attendance: 'الحضور والمواظبة', days: 'أيام الدراسة', present: 'الحضور', absent: 'الغياب',
    teacher: 'ملاحظات المعلم', principal: 'ملاحظات الإدارة', sigTeacher: 'توقيع المعلم', sigHead: 'توقيع الإدارة', sigParent: 'توقيع ولي الأمر',
    stamp: 'ختم المدرسة', verify: 'رمز التحقق', qr: 'رمز التحقق من النتيجة', aria: 'بطاقة نتائج المدرسة الإسلامية',
  },
  ha: {
    bismillah: 'Da sunan Allah Mai Rahama, Mai Jinƙai', fallbackSchool: 'Makarantar Islamiyya', title: 'Takardar Sakamako da Ci gaban Karatu', photo: 'Hoton ɗalibi', logo: 'Tambarin makaranta',
    name: 'Sunan ɗalibi', admission: 'Lambar rijista', klass: 'Aji', session: 'Shekarar karatu', term: 'Zango',
    results: 'Sakamakon darussa', subject: 'Darasi', ca: 'Gwajin ci gaba (CA)', exam: 'Jarrabawa', total: 'Jimilla', grade: 'Daraja', position: 'Matsayi', remarks: 'Bayani',
    noResults: 'Ba a shigar da sakamakon darussa na wannan zangon ba', average: 'Matsakaicin maki', classPosition: 'Matsayi a aji',
    quran: "Bibiyar haddar Alƙur'ani, Tajwidi da Bitarwa", date: 'Kwanan wata', from: 'Daga sura / aya', to: 'Zuwa sura / aya', assessment: 'Tantancewa', score: 'Maki',
    attendance: 'Halartar makaranta', days: 'Kwanakin makaranta', present: 'Ya halarta', absent: 'Bai halarta ba',
    teacher: "Ra'ayin malami", principal: "Ra'ayin shugaban makaranta", sigTeacher: 'Sa hannun malami', sigHead: 'Sa hannun shugaba', sigParent: 'Sa hannun iyaye',
    stamp: 'Hatimin makaranta', verify: 'Lambar tantancewa', qr: 'Lambar QR ta tantance sakamako', aria: 'Takardar sakamakon Islamiyya',
  },
} as const;
export type ReportLabelKey = keyof typeof REPORT_LABELS.ar;
