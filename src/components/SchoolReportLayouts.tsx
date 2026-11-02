import type { CSSProperties } from 'react';
import { REPORT_LAYOUTS, resolveReportTemplate, positionVisibility, type ReportLayoutId, type ReportPart } from '@/lib/report-template';
import { islamiyyaTotals, type IslamiyyaAssessment } from '@/lib/islamiyya-report';

export type SchoolReport = {
  schools?: { name?: string; logo_url?: string | null; motto?: string | null; address?: string | null; report_template?: unknown; principal_signature_url?: string | null; stamp_url?: string | null; principal_name?: string | null };
  students?: { first_name?: string; middle_name?: string | null; last_name?: string; admission_no?: string; gender?: string; dob?: string | null; photo_url?: string | null };
  classes?: { name?: string; arm?: string | null; section?: string | null };
  session?: string | null; term?: string | null; position?: number | null; class_size?: number | null;
  days_present?: number | null; days_absent?: number | null; days_total?: number | null;
  teacher_remark?: string | null; principal_remark?: string | null; verification_code?: string | null;
  affective?: Record<string, number | null>; psychomotor?: Record<string, number | null>;
};

const TITLES: Partial<Record<ReportLayoutId, string>> = {
  classic_comprehensive: 'Terminal Academic Report', premier_standard: 'Pupil Performance Report',
  modern_executive: 'Academic Performance Profile', ubec_basic: 'Basic Education Progress Report',
  islamic_integrated: 'Integrated Academic & Islamic Report', waec_senior: 'Senior Secondary Academic Transcript',
};
const number = (value: number | string | null | undefined) => value == null ? '—' : typeof value === 'number' ? new Intl.NumberFormat('en-NG', { maximumFractionDigits: 2 }).format(value) : value;

export function SchoolReportLayouts({ rc, assessments, qrDataUrl }: { rc: SchoolReport; assessments: IslamiyyaAssessment[]; qrDataUrl?: string }) {
  const school = rc.schools ?? {};
  const student = rc.students ?? {};
  const template = resolveReportTemplate(school.report_template, rc.classes?.section);
  const layout = template.layout_id;
  const style = Object.fromEntries((['border', 'heading', 'table', 'rows', 'biodata', 'development', 'comments'] as ReportPart[]).map(part => [`--rc-${part}`, `var(--report-colour-${template[part]})`])) as CSSProperties;
  const positions = positionVisibility(template.positions);
  const totals = islamiyyaTotals(assessments);
  const fullName = [student.first_name, student.middle_name, student.last_name].filter(Boolean).join(' ');
  const term = rc.term ? ({ first: 'First Term', second: 'Second Term', third: 'Third Term' }[rc.term] ?? rc.term) : '—';
  const definition = REPORT_LAYOUTS.find(l => l.id === layout);
  const islamic = /qur.?an|islam|arabic|tajw|tahf|hifz|fiqh|hadith|aq[ie]d|seerah|adab|أ|قرآن/i;
  const subjectGroups = layout === 'islamic_integrated' ? [
    { title: 'General academic subjects', rows: assessments.filter(a => !islamic.test(a.subjects?.name ?? '')) },
    { title: 'Islamic & Arabic studies / الدراسات الإسلامية والعربية', rows: assessments.filter(a => islamic.test(a.subjects?.name ?? '')) },
  ] : layout === 'modern_executive' ? [
    { title: 'Science & Technology', rows: assessments.filter(a => /math|science|physics|chem|bio|ict|comput/i.test(a.subjects?.name ?? '')) },
    { title: 'Languages, Humanities & Other Studies', rows: assessments.filter(a => !/math|science|physics|chem|bio|ict|comput/i.test(a.subjects?.name ?? '')) },
  ] : [{ title: layout === 'waec_senior' ? 'Subject results — recorded school grades' : 'Academic results', rows: assessments }];
  const results = <div className="space-y-4">{subjectGroups.map(group => <section key={group.title}><h3 className="report-heading mb-2 font-bold">{group.title}</h3><table className="report-results school-report-table"><thead><tr><th>Subject</th>{layout === 'classic_comprehensive' ? <><th>CA 1</th><th>CA 2</th></> : <th>CA</th>}<th>Exam</th><th>Total</th><th>Grade</th>{positions.subject && <th>Position</th>}<th>Remark</th></tr></thead><tbody>{group.rows.map(a => <tr key={a.id}><td>{a.subjects?.name ?? '—'}</td>{layout === 'classic_comprehensive' ? <><td>{number(a.ca1)}</td><td>{number(a.ca2)}</td></> : <td>{a.ca1 == null && a.ca2 == null ? '—' : number(Number(a.ca1 ?? 0) + Number(a.ca2 ?? 0))}</td>}<td>{number(a.exam)}</td><td className="font-bold">{number(a.total)}</td><td>{a.grade ?? '—'}</td>{positions.subject && <td>{number(a.subject_position)}</td>}<td>{a.remark ?? '—'}</td></tr>)}{!group.rows.length && <tr><td colSpan={10}>No results recorded.</td></tr>}</tbody></table></section>)}</div>;
  const summary = <section className="report-biodata school-report-summary"><h3 className="font-bold">Performance summary</h3><dl className="grid grid-cols-2 gap-3 mt-3 text-sm">{[['Total score', number(totals.total)], ['Average', number(totals.average)], ...(positions.class ? [['Class position', number(rc.position)]] : []), ['Class size', number(rc.class_size)]].map(([label, value]) => <div key={label}><dt>{label}</dt><dd className="text-lg font-bold">{value}</dd></div>)}</dl></section>;
  const development = <section className="report-development"><h3 className="mb-2 font-bold">{layout === 'islamic_integrated' ? 'Character & Adab' : 'Personal development'}</h3><table className="school-report-table"><tbody>{[['Attentiveness', rc.affective?.attentiveness], ['Honesty', rc.affective?.honesty], ['Neatness', rc.affective?.neatness], ['Politeness', rc.affective?.politeness], ['Handwriting', rc.psychomotor?.handwriting]].map(([label, value]) => <tr key={String(label)}><td>{label}</td><td>{number(value)} / 5</td></tr>)}</tbody></table></section>;
  return <article className={`school-report-sheet report-sheet report-frame print-doc layout-${layout}`} style={style} aria-label={definition?.name} data-report-layout={layout}>
    {school.logo_url && <img src={school.logo_url} alt="" className="islamiyya-watermark" aria-hidden="true" />}
    <div className="relative z-10 space-y-5">
      <div className="school-report-header"><div className="flex h-20 w-20 items-center justify-center">{school.logo_url && <img src={school.logo_url} alt="School logo" className="max-h-20 max-w-20 object-contain" />}</div><div className="text-center min-w-0"><h2 className="report-heading text-2xl font-bold break-words">{school.name || 'School Report'}</h2>{school.motto && <p className="text-sm italic">{school.motto}</p>}{school.address && <p className="text-xs break-words">{school.address}</p>}<h3 className="report-heading mt-3 text-lg font-bold">{TITLES[layout]}</h3><p className="text-sm">{rc.session ?? '—'} · {term}</p></div><div className="h-24 w-20 border flex items-center justify-center">{student.photo_url ? <img src={student.photo_url} alt="Student passport" className="h-full w-full object-cover" /> : <span className="text-xs">Passport</span>}</div></div>
      <dl className="report-biodata grid grid-cols-2 gap-3 text-sm">{[['Student name', fullName || '—'], ['Admission number', student.admission_no ?? '—'], ['Class', [rc.classes?.name, rc.classes?.arm].filter(Boolean).join(' ') || '—'], ['Gender', student.gender ?? '—']].map(([label, value]) => <div key={label} className="min-w-0"><dt className="font-semibold">{label}</dt><dd className="break-words">{value}</dd></div>)}</dl>
      {layout === 'modern_executive' && summary}
      <div className={layout === 'classic_comprehensive' ? 'school-report-classic-grid' : 'space-y-4'}>{results}{layout === 'classic_comprehensive' && <div className="space-y-4">{summary}{development}</div>}</div>
      {layout !== 'classic_comprehensive' && layout !== 'modern_executive' && summary}
      {layout === 'modern_executive' && <section><h3 className="report-heading font-bold mb-3">Subject performance</h3><div className="space-y-2">{assessments.map(a => <div key={a.id} className="school-report-bar-row"><span className="text-xs break-words">{a.subjects?.name}</span><progress max={100} value={a.total ?? 0} aria-label={a.subjects?.name} /><strong className="text-sm">{number(a.total)}</strong></div>)}</div></section>}
      {layout === 'ubec_basic' && development}
      <section className="text-sm"><h3 className="report-heading mb-2 font-bold">Attendance & punctuality</h3><div className="grid grid-cols-3 gap-3 border p-3"><p>School days: <strong>{number(rc.days_total)}</strong></p><p>Present: <strong>{number(rc.days_present)}</strong></p><p>Absent: <strong>{number(rc.days_absent)}</strong></p></div></section>
      <section className="report-comments grid gap-3 text-sm"><div className="border p-3"><strong>Class teacher’s remark: </strong>{rc.teacher_remark || '—'}</div><div className="border p-3"><strong>Head of school’s remark: </strong>{rc.principal_remark || '—'}</div></section>
      <div className="grid grid-cols-3 gap-4 text-center text-xs">{['Class teacher', school.principal_name || 'Head of school', 'Parent / guardian'].map((label, i) => <div key={`${i}-${label}`}><div className="h-14 flex items-center justify-center">{i === 1 && school.principal_signature_url && <img src={school.principal_signature_url} alt="Head of school signature" className="max-h-12 max-w-28 object-contain" />}</div><p className="border-t pt-2">{label}</p></div>)}</div>
      <div className="flex flex-wrap justify-between items-center gap-3 border-t pt-3 text-xs">{school.stamp_url && <img src={school.stamp_url} alt="School stamp" className="max-h-16 max-w-28 object-contain" />}{rc.verification_code && <p>Verification code: <bdi>{rc.verification_code}</bdi></p>}{qrDataUrl && rc.verification_code && <img src={qrDataUrl} alt="Verify report" className="h-14 w-14" />}</div>
    </div>
  </article>;
}