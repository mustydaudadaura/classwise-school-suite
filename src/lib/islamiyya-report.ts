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