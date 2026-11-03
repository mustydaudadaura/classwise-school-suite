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

/** The four selectable report sheet designs. Older saved ids are kept only so stored settings still resolve. */
export type ReportSheetId = 'sheet_alqalam' | 'sheet_emerald' | 'sheet_hisgrace' | 'sheet_fmp';
export type ReportLayoutId = ReportSheetId
  | 'classic_comprehensive' | 'premier_standard' | 'modern_executive' | 'ubec_basic' | 'islamic_integrated'
  | 'islamiyya_arabic' | 'islamiyya_hausa' | 'islamiyya_arabic_hausa' | 'waec_senior';
export type ReportLanguage = 'en' | 'ar' | 'ha';

export interface ReportLayoutDefinition {
  id: ReportSheetId;
  name: string;
  tagline: string;
  description: string;
  badge: string;
}

export const REPORT_LANGUAGES: { id: ReportLanguage; name: string }[] = [
  { id: 'en', name: 'English' },
  { id: 'ar', name: 'العربية — Arabic' },
  { id: 'ha', name: 'Hausa' },
];

export const REPORT_LAYOUTS: ReportLayoutDefinition[] = [
  { id: 'sheet_alqalam', name: 'Al-Qalam Performance Report', tagline: 'Personal data, attendance and performance summary boxes', description: 'Cognitive domain table with CA, exam, term totals and class average; affective and psychomotor tick grid; grade scale; remarks and stamp.', badge: 'Design 1' },
  { id: 'sheet_emerald', name: 'Emerald Termly Result Sheet', tagline: 'Bold banner header with test columns and max/min marks', description: 'Test 1, Test 2, Exam and Total with rank, grade and remark; term averages, class highest/lowest, attendance summary, domains and QR code.', badge: 'Design 2' },
  { id: 'sheet_hisgrace', name: 'Hisgrace Report Sheet', tagline: 'Clean bordered layout with grouped subjects', description: 'Student data, attendance, terminal duration and score summary; subjects in category bands; rating keys; affective and psychomotor ticks; comments and stamp.', badge: 'Design 3' },
  { id: 'sheet_fmp', name: 'FMP Continuous Assessment Report', tagline: 'Simple shaded table, quick to read', description: 'Compact biodata grid, CA/Exam/Total/Position/Grade/Remark table, totals and percentage, domain scores and teacher/principal comments with dates.', badge: 'Design 4' },
];

export type ReportTemplate = Partial<Record<ReportPart, ReportColour>> & {
  layout_id?: ReportLayoutId;
  report_language?: ReportLanguage;
  positions?: 'none' | 'class' | 'subject' | 'both';
  arabic_school_name?: string;
  arabic_address?: string;
};

export function resolveReportTemplate(value: unknown, section?: string | null): Required<Omit<ReportTemplate, 'layout_id'>> & { layout_id: ReportSheetId } {
  const fallback = section === 'nursery' ? 'forest' : section === 'primary' ? 'blue' : 'purple';
  const source = value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
  const colour = (key: ReportPart): ReportColour =>
    REPORT_COLOURS.includes(source[key] as ReportColour) ? (source[key] as ReportColour) : fallback;

  const layout_id: ReportSheetId = REPORT_LAYOUTS.some(l => l.id === source.layout_id)
    ? (source.layout_id as ReportSheetId)
    : 'sheet_alqalam';
  const legacyLanguage: ReportLanguage | null = source.layout_id === 'islamiyya_arabic' || source.layout_id === 'islamiyya_arabic_hausa' ? 'ar' : source.layout_id === 'islamiyya_hausa' ? 'ha' : null;
  const report_language: ReportLanguage = ['en', 'ar', 'ha'].includes(String(source.report_language))
    ? (source.report_language as ReportLanguage)
    : legacyLanguage ?? 'en';

  return {
    arabic_school_name: typeof source.arabic_school_name === 'string' ? source.arabic_school_name : '',
    arabic_address: typeof source.arabic_address === 'string' ? source.arabic_address : '',
    layout_id,
    report_language,
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
