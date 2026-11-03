export const REPORT_COLOURS = [
  'emerald', 'forest', 'green', 'lime', 'olive', 'teal', 'turquoise', 'cyan', 'sky', 'blue',
  'navy', 'indigo', 'violet', 'purple', 'plum', 'magenta', 'pink', 'rose', 'red', 'crimson',
  'orange', 'amber', 'gold', 'brown', 'slate', 'charcoal'
] as const;

export const REPORT_PARTS = {
  border: 'Sheet border',
  heading: 'School heading',
  table: 'Results headings',
  rows: 'Alternate subject rows',
  biodata: 'Student details',
  development: 'Development ratings',
  comments: 'Staff comments'
};

export type ReportColour = typeof REPORT_COLOURS[number];
export type ReportPart = keyof typeof REPORT_PARTS;

export type ReportLayoutId =
  | 'classic_comprehensive'  // Re-included classic Nigerian comprehensive format
  | 'premier_standard'       // Standard Single-Page A4
  | 'modern_executive'       // Modern STEM / Executive Hybrid
  | 'ubec_basic'             // Universal Basic Education / State Ministry format
  | 'islamic_integrated'     // Islamic & Arabic Integrated Academy format
  | 'islamiyya_arabic'
  | 'islamiyya_hausa'
  | 'islamiyya_arabic_hausa'
  | 'waec_senior';           // WAEC / NECO Senior Secondary format

export interface ReportLayoutDefinition {
  id: ReportLayoutId;
  name: string;
  tagline: string;
  description: string;
  badge: string;
}

export const REPORT_LAYOUTS: ReportLayoutDefinition[] = [
  {
    id: 'islamiyya_arabic',
    name: 'Islamiyya — Arabic Report Card',
    tagline: 'بطاقة نتائج المدرسة الإسلامية',
    description: 'Right-to-left Arabic report with subject results, Quran progress, attendance, remarks, school watermark and signatures.',
    badge: 'العربية / Islamiyya'
  },
  {
    id: 'islamiyya_hausa',
    name: 'Islamiyya — Hausa Report Card',
    tagline: 'Takardar sakamakon Islamiyya da Hausa',
    description: 'Fully Hausa report for parents who read Hausa best: same results, positions, attendance, remarks, watermark and signatures.',
    badge: 'Hausa'
  },
  {
    id: 'islamiyya_arabic_hausa',
    name: 'Islamiyya — Arabic + Hausa Report Card',
    tagline: 'العربية والهوسا · Larabci da Hausa',
    description: 'Every heading shown in Hausa with the Arabic beneath it, so both readers understand the same results.',
    badge: 'Arabic + Hausa'
  },
  {
    id: 'classic_comprehensive',
    name: 'English — Classic Comprehensive Academy',
    tagline: 'Traditional Nigerian full-format report sheet with comprehensive psychomotor & affective matrix',
    description: 'The beloved traditional Nigerian 2-column academic report sheet. Features continuous assessment breakdown (CA1, CA2, CA3/Project, Exam), class statistics, 10-trait behavioral domain ratings, teacher & principal remarks, and performance analytics.',
    badge: 'Classic 2nd Template (Reincluded)'
  },
  {
    id: 'premier_standard',
    name: 'Premier Ministry Standard (A4 Single-Page)',
    tagline: 'Standard Federal Unity College & State Ministry of Education format',
    description: 'Official single-sheet format with clear continuous assessment weights, position ranking, grade distribution donut chart, and top subject performance bars.',
    badge: 'Federal / State Standard'
  },
  {
    id: 'modern_executive',
    name: 'Modern Executive STEM & Cambridge Hybrid',
    tagline: 'Executive layout for STEM curricula and British-Nigerian schools',
    description: 'Distinctive grouped subject clusters (Sciences, Arts, Commercials), comparative performance bar index, visual mastery donuts, and termly cumulative progress tracking.',
    badge: 'Modern STEM / British'
  },
  {
    id: 'ubec_basic',
    name: 'Universal Basic Education (UBEC / State Ministry)',
    tagline: 'Official format for Nursery, Primary and Junior Secondary (JSS 1-3)',
    description: 'Formative continuous assessment (40%) and summative exam (60%) with national core competencies, civic qualities, and physical development index.',
    badge: 'UBEC / Universal Basic'
  },
  {
    id: 'islamic_integrated',
    name: 'Islamic & Arabic Integrated Academy',
    tagline: 'Dual Western & Islamic curriculum report sheet (Daura / Northern standard)',
    description: 'Accommodates Western academic subjects alongside Arabic Language, Islamic Studies, Tahfeez (Hifz), and moral etiquette (Adab), with clean spaces for official stamp and signature.',
    badge: 'Islamic Integrated'
  },
  {
    id: 'waec_senior',
    name: 'WAEC / NECO Senior Secondary Transcript (SS1 - SS3)',
    tagline: 'Senior Secondary format aligned with WAEC 9-point grading (A1 to F9)',
    description: 'Designed for senior secondary students preparing for WASSCE/SSCE. Features 9-point WAEC grading bands (A1-F9), cumulative GPA, career stream recommendations, and terminal verification.',
    badge: 'WAEC / Senior Secondary'
  }
];

export type ReportTemplate = Partial<Record<ReportPart, ReportColour>> & {
  layout_id?: ReportLayoutId;
  positions?: 'none' | 'class' | 'subject' | 'both';
  arabic_school_name?: string;
  arabic_address?: string;
};

export function resolveReportTemplate(value: unknown, section?: string | null): Required<ReportTemplate> {
  const fallback = section === 'nursery' ? 'forest' : section === 'primary' ? 'blue' : 'purple';
  const source = value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
  const colour = (key: ReportPart): ReportColour =>
    REPORT_COLOURS.includes(source[key] as ReportColour) ? (source[key] as ReportColour) : fallback;

  const validLayouts: ReportLayoutId[] = [
    'classic_comprehensive',
    'premier_standard',
    'modern_executive',
    'ubec_basic',
    'islamic_integrated',
    'islamiyya_arabic',
    'islamiyya_hausa',
    'islamiyya_arabic_hausa',
    'waec_senior'
  ];

  const layout_id: ReportLayoutId = validLayouts.includes(source.layout_id as ReportLayoutId)
    ? (source.layout_id as ReportLayoutId)
    : 'classic_comprehensive';

  return {
    arabic_school_name: typeof source.arabic_school_name === 'string' ? source.arabic_school_name : '',
    arabic_address: typeof source.arabic_address === 'string' ? source.arabic_address : '',
    layout_id,
    border: colour('border'),
    heading: colour('heading'),
    table: colour('table'),
    rows: colour('rows'),
    biodata: colour('biodata'),
    development: colour('development'),
    comments: colour('comments'),
    positions: ['none', 'class', 'subject', 'both'].includes(String(source.positions))
      ? (source.positions as Required<ReportTemplate>['positions'])
      : 'class'
  };
}

export function positionVisibility(mode: Required<ReportTemplate>['positions']) {
  return { class: mode === 'class' || mode === 'both', subject: mode === 'subject' || mode === 'both' };
}

/** Islamiyya language for a layout, or null for the English layouts. */
export function islamiyyaLanguage(layout: ReportLayoutId): 'ar' | 'ha' | 'ar_ha' | null {
  return layout === 'islamiyya_arabic' ? 'ar' : layout === 'islamiyya_hausa' ? 'ha' : layout === 'islamiyya_arabic_hausa' ? 'ar_ha' : null;
}
