import type { CSSProperties, ReactNode } from 'react';
import {
  arabicNumber, arabicReportText, hausaReportText, islamiyyaTotals, plainNumber, REPORT_LABELS,
  type IslamiyyaAssessment, type IslamiyyaProgress, type ReportLabelKey, type ReportLanguage,
} from '@/lib/islamiyya-report';
import { positionVisibility, resolveReportTemplate } from '@/lib/report-template';

type ReportIdentity = {
  schools?: { name?: string; logo_url?: string | null; address?: string | null; report_template?: unknown; principal_signature_url?: string | null; stamp_url?: string | null };
  students?: { first_name?: string; middle_name?: string | null; last_name?: string; admission_no?: string; photo_url?: string | null };
  classes?: { name?: string; arm?: string | null };
  session?: string | null; term?: string | null; position?: number | null;
  days_present?: number | null; days_absent?: number | null; days_total?: number | null;
  teacher_remark?: string | null; principal_remark?: string | null; verification_code?: string | null;
};

/**
 * Islamiyya report card in Arabic (right-to-left), Hausa, or Arabic + Hausa together.
 * Every language shows the same saved scores; only labels and known terms are translated.
 */
export function IslamiyyaReportCard({ rc, assessments, progress = [], qrDataUrl, language = 'ar' }: {
  rc: ReportIdentity; assessments: IslamiyyaAssessment[]; progress?: IslamiyyaProgress[]; qrDataUrl?: string; language?: ReportLanguage;
}) {
  const school = rc.schools ?? {};
  const student = rc.students ?? {};
  const settings = school.report_template && typeof school.report_template === 'object'
    ? school.report_template as Record<string, unknown> : {};
  const template = resolveReportTemplate({ heading: 'forest', border: 'forest', table: 'forest', rows: 'forest', biodata: 'forest', development: 'forest', comments: 'forest', ...settings });
  const style = Object.fromEntries(['border', 'heading', 'table', 'rows', 'biodata', 'development', 'comments'].map(part => [`--rc-${part}`, `var(--report-colour-${template[part as keyof typeof template]})`])) as CSSProperties;
  const fullName = [student.first_name, student.middle_name, student.last_name].filter(Boolean).join(' ');
  const totals = islamiyyaTotals(assessments);
  const positions = positionVisibility(template.positions);
  const rtl = language === 'ar';
  const num = language === 'ar' ? arabicNumber : plainNumber;
  const L = (key: ReportLabelKey): ReactNode => language === 'ar' ? REPORT_LABELS.ar[key]
    : language === 'ha' ? REPORT_LABELS.ha[key]
    : <span className="inline-flex flex-col leading-tight"><span>{REPORT_LABELS.ha[key]}</span><span dir="rtl" lang="ar" className="text-[0.85em] opacity-90">{REPORT_LABELS.ar[key]}</span></span>;
  const T = (value: string | null | undefined): ReactNode => {
    if (language === 'ar') return arabicReportText(value);
    const ha = hausaReportText(value);
    if (language === 'ha') return ha;
    const ar = arabicReportText(value);
    return ar !== ha ? <>{ha} <span dir="rtl" lang="ar">/ {ar}</span></> : ha;
  };
  const arabicName = typeof settings.arabic_school_name === 'string' && settings.arabic_school_name.trim() ? settings.arabic_school_name : '';
  const arabicAddress = typeof settings.arabic_address === 'string' && settings.arabic_address.trim() ? settings.arabic_address : '';
  const identity: [ReportLabelKey, ReactNode][] = [
    ['name', fullName || '—'], ['admission', student.admission_no || '—'],
    ['klass', [rc.classes?.name, rc.classes?.arm].filter(Boolean).join(' ') || '—'],
    ['session', rc.session || '—'], ['term', T(rc.term)],
  ];
  const plain = (key: ReportLabelKey) => language === 'ar' ? REPORT_LABELS.ar[key] : REPORT_LABELS.ha[key];
  const resultHeads: ReportLabelKey[] = ['subject', 'ca', 'exam', 'total', 'grade', ...(positions.subject ? ['position' as const] : []), 'remarks'];
  return <article aria-label={plain('aria')} dir={rtl ? 'rtl' : 'ltr'} lang={language === 'ha' ? 'ha' : language === 'ar' ? 'ar' : 'ha'} className={`islamiyya-sheet report-sheet report-frame print-doc report-lang-${language}`} style={style} data-report-language={language}>
    {school.logo_url && <img src={school.logo_url} alt="" aria-hidden="true" className="islamiyya-watermark" />}
    <div className="relative z-10 space-y-5">
      <div className="islamiyya-header">
        <div className="flex h-20 w-20 items-center justify-center">{school.logo_url && <img src={school.logo_url} alt={plain('logo')} className="max-h-20 max-w-20 object-contain" />}</div>
        <div className="min-w-0 text-center">
          <p className="text-sm">{language === 'ha' ? REPORT_LABELS.ha.bismillah : REPORT_LABELS.ar.bismillah}</p>
          {language !== 'ha' && arabicName && <h2 dir="rtl" lang="ar" className="report-heading text-2xl font-bold break-words">{arabicName}</h2>}
          {(language !== 'ar' || !arabicName) && <h2 className="report-heading text-2xl font-bold break-words">{school.name || plain('fallbackSchool')}</h2>}
          {language !== 'ha' && arabicAddress && <p dir="rtl" lang="ar" className="text-sm break-words">{arabicAddress}</p>}
          {(language !== 'ar' || !arabicAddress) && school.address && <p className="text-sm break-words">{school.address}</p>}
          <h3 className="report-heading mt-3 border-y py-2 text-lg font-bold">{L('title')}</h3>
        </div>
        <div className="flex h-24 w-20 items-center justify-center border">{student.photo_url ? <img src={student.photo_url} alt={plain('photo')} className="h-full w-full object-cover" /> : <span className="text-xs text-center">{L('photo')}</span>}</div>
      </div>
      <dl className="report-biodata grid grid-cols-2 gap-3 text-sm">{identity.map(([label, value]) => <div key={label} className="min-w-0"><dt className="font-bold">{L(label)}</dt><dd className="break-words"><bdi>{value}</bdi></dd></div>)}</dl>
      <section><h3 className="report-heading mb-2 font-bold">{L('results')}</h3>
        <table className="report-results islamiyya-table"><thead><tr>{resultHeads.map(h => <th key={h}>{L(h)}</th>)}</tr></thead>
          <tbody>{assessments.map(a => <tr key={a.id}><td><bdi>{language === 'ar' ? arabicReportText(a.subjects?.name) : (a.subjects?.name ?? '—')}</bdi></td><td>{a.ca1 == null && a.ca2 == null ? '—' : num(Number(a.ca1 ?? 0) + Number(a.ca2 ?? 0))}</td><td>{num(a.exam)}</td><td className="font-bold">{num(a.total)}</td><td><bdi>{language === 'ar' ? arabicReportText(a.remark || a.grade) : (a.grade || '—')}</bdi></td>{positions.subject && <td>{num(a.subject_position)}</td>}<td><bdi>{T(a.remark)}</bdi></td></tr>)}
            {!assessments.length && <tr><td colSpan={resultHeads.length}>{L('noResults')}</td></tr>}</tbody>
        </table>
      </section>
      <div className="report-biodata grid grid-cols-2 gap-3 text-sm"><p>{L('total')}: <strong>{num(totals.total)}</strong></p><p>{L('average')}: <strong>{num(totals.average)}</strong></p>{positions.class && <p>{L('classPosition')}: <strong>{num(rc.position)}</strong></p>}</div>
      {progress.length > 0 && <section><h3 className="report-heading mb-2 font-bold">{L('quran')}</h3><table className="report-results islamiyya-table"><thead><tr>{(['date', 'from', 'to', 'assessment', 'score', 'remarks'] as ReportLabelKey[]).map(h => <th key={h}>{L(h)}</th>)}</tr></thead><tbody>{progress.map(r => <tr key={r.id}><td>{new Date(`${r.record_date}T12:00:00`).toLocaleDateString(language === 'ar' ? 'ar-NG' : 'en-NG')}</td><td><bdi>{r.surah_from}</bdi> {num(r.ayah_from)}</td><td><bdi>{r.surah_to}</bdi> {num(r.ayah_to)}</td><td>{T(r.assessment_type)}</td><td>{num(r.score)}</td><td><bdi>{T(r.remarks || r.grade)}</bdi></td></tr>)}</tbody></table></section>}
      <section className="text-sm"><h3 className="report-heading mb-2 font-bold">{L('attendance')}</h3><div className="grid grid-cols-3 gap-2 border p-3"><p>{L('days')}: {num(rc.days_total)}</p><p>{L('present')}: {num(rc.days_present)}</p><p>{L('absent')}: {num(rc.days_absent)}</p></div></section>
      <section className="report-comments space-y-2 text-sm"><div className="border p-3"><strong>{L('teacher')}: </strong><bdi>{T(rc.teacher_remark)}</bdi></div><div className="border p-3"><strong>{L('principal')}: </strong><bdi>{T(rc.principal_remark)}</bdi></div></section>
      <div className="grid grid-cols-3 gap-4 text-center text-sm">{(['sigTeacher', 'sigHead', 'sigParent'] as ReportLabelKey[]).map((label, i) => <div key={label}><div className="flex h-14 items-center justify-center">{i === 1 && school.principal_signature_url && <img src={school.principal_signature_url} alt={plain('sigHead')} className="max-h-12 max-w-28 object-contain" />}</div><p className="border-t pt-2">{L(label)}</p></div>)}</div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-3 text-xs"><div>{school.stamp_url && <img src={school.stamp_url} alt={plain('stamp')} className="max-h-16 max-w-28 object-contain" />}</div>{rc.verification_code && <p>{L('verify')}: <bdi>{rc.verification_code}</bdi></p>}{qrDataUrl && rc.verification_code && <img src={qrDataUrl} alt={plain('qr')} className="h-14 w-14" />}</div>
    </div>
  </article>;
}
