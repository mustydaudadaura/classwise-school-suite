import type { CSSProperties } from 'react';
import { arabicNumber, arabicReportText, islamiyyaTotals, type IslamiyyaAssessment, type IslamiyyaProgress } from '@/lib/islamiyya-report';
import { positionVisibility, resolveReportTemplate } from '@/lib/report-template';

type ReportIdentity = {
  schools?: { name?: string; logo_url?: string | null; address?: string | null; report_template?: unknown; principal_signature_url?: string | null; stamp_url?: string | null };
  students?: { first_name?: string; middle_name?: string | null; last_name?: string; admission_no?: string; photo_url?: string | null };
  classes?: { name?: string; arm?: string | null };
  session?: string | null; term?: string | null; position?: number | null;
  days_present?: number | null; days_absent?: number | null; days_total?: number | null;
  teacher_remark?: string | null; principal_remark?: string | null; verification_code?: string | null;
};

export function IslamiyyaReportCard({ rc, assessments, progress = [], qrDataUrl }: {
  rc: ReportIdentity; assessments: IslamiyyaAssessment[]; progress?: IslamiyyaProgress[]; qrDataUrl?: string;
}) {
  const school = rc.schools ?? {};
  const student = rc.students ?? {};
  const settings = school.report_template && typeof school.report_template === 'object'
    ? school.report_template as Record<string, unknown> : {};
  const template = resolveReportTemplate({ heading: 'forest', border: 'forest', table: 'forest', rows: 'forest', biodata: 'forest', development: 'forest', comments: 'forest', ...settings });
  const style = Object.fromEntries(['border', 'heading', 'table', 'rows', 'biodata', 'development', 'comments'].map(part => [`--rc-${part}`, `var(--report-colour-${template[part as keyof typeof template]})`])) as CSSProperties;
  const name = [student.first_name, student.middle_name, student.last_name].filter(Boolean).join(' ');
  const totals = islamiyyaTotals(assessments);
  const positions = positionVisibility(template.positions);
  const identity = [
    ['اسم الطالب', name || '—'], ['رقم القيد', student.admission_no || '—'],
    ['الصف', [rc.classes?.name, rc.classes?.arm].filter(Boolean).join(' ') || '—'],
    ['العام الدراسي', rc.session || '—'], ['الفصل الدراسي', arabicReportText(rc.term)],
  ];
  return <article aria-label="بطاقة نتائج المدرسة الإسلامية" dir="rtl" lang="ar" className="islamiyya-sheet report-sheet report-frame print-doc" style={style}>
    {school.logo_url && <img src={school.logo_url} alt="" aria-hidden="true" className="islamiyya-watermark" />}
    <div className="relative z-10 space-y-5">
      <div className="islamiyya-header">
        <div className="flex h-20 w-20 items-center justify-center">{school.logo_url && <img src={school.logo_url} alt="شعار المدرسة" className="max-h-20 max-w-20 object-contain" />}</div>
        <div className="min-w-0 text-center">
          <p className="text-sm">بسم الله الرحمن الرحيم</p>
          <h2 className="report-heading text-2xl font-bold break-words">{typeof settings.arabic_school_name === 'string' && settings.arabic_school_name.trim() ? settings.arabic_school_name : school.name || 'المدرسة الإسلامية'}</h2>
          <p className="text-sm break-words">{typeof settings.arabic_address === 'string' ? settings.arabic_address : school.address}</p>
          <h3 className="report-heading mt-3 border-y py-2 text-lg font-bold">بطاقة النتائج والتقدم الدراسي</h3>
        </div>
        <div className="flex h-24 w-20 items-center justify-center border">{student.photo_url ? <img src={student.photo_url} alt="صورة الطالب" className="h-full w-full object-cover" /> : <span className="text-xs">صورة الطالب</span>}</div>
      </div>
      <dl className="report-biodata grid grid-cols-2 gap-3 text-sm">{identity.map(([label, value]) => <div key={label} className="min-w-0"><dt className="font-bold">{label}</dt><dd className="break-words"><bdi>{value}</bdi></dd></div>)}</dl>
      <section><h3 className="report-heading mb-2 font-bold">نتائج المواد الدراسية</h3>
        <table className="report-results islamiyya-table"><thead><tr>{['المادة', 'التقييم المستمر', 'الامتحان', 'المجموع', 'التقدير', ...(positions.subject ? ['الترتيب'] : []), 'الملاحظات'].map(h => <th key={h}>{h}</th>)}</tr></thead>
          <tbody>{assessments.map(a => <tr key={a.id}><td><bdi>{arabicReportText(a.subjects?.name)}</bdi></td><td>{a.ca1 == null && a.ca2 == null ? '—' : arabicNumber(Number(a.ca1 ?? 0) + Number(a.ca2 ?? 0))}</td><td>{arabicNumber(a.exam)}</td><td className="font-bold">{arabicNumber(a.total)}</td><td><bdi>{arabicReportText(a.remark || a.grade)}</bdi></td>{positions.subject && <td>{arabicNumber(a.subject_position)}</td>}<td><bdi>{arabicReportText(a.remark)}</bdi></td></tr>)}
            {!assessments.length && <tr><td colSpan={positions.subject ? 7 : 6}>لم تُسجَّل نتائج المواد لهذا الفصل</td></tr>}</tbody>
        </table>
      </section>
      <div className="report-biodata grid grid-cols-2 gap-3 text-sm"><p>المجموع: <strong>{arabicNumber(totals.total)}</strong></p><p>المعدل: <strong>{arabicNumber(totals.average)}</strong></p>{positions.class && <p>الترتيب في الصف: <strong>{arabicNumber(rc.position)}</strong></p>}</div>
      {progress.length > 0 && <section><h3 className="report-heading mb-2 font-bold">متابعة حفظ القرآن الكريم والتجويد والمراجعة</h3><table className="report-results islamiyya-table"><thead><tr>{['التاريخ', 'من سورة / آية', 'إلى سورة / آية', 'التقييم', 'الدرجة', 'الملاحظات'].map(h => <th key={h}>{h}</th>)}</tr></thead><tbody>{progress.map(r => <tr key={r.id}><td>{new Date(`${r.record_date}T12:00:00`).toLocaleDateString('ar-NG')}</td><td><bdi>{r.surah_from}</bdi> {arabicNumber(r.ayah_from)}</td><td><bdi>{r.surah_to}</bdi> {arabicNumber(r.ayah_to)}</td><td>{arabicReportText(r.assessment_type)}</td><td>{arabicNumber(r.score)}</td><td><bdi>{arabicReportText(r.remarks || r.grade)}</bdi></td></tr>)}</tbody></table></section>}
      <section className="text-sm"><h3 className="report-heading mb-2 font-bold">الحضور والمواظبة</h3><div className="grid grid-cols-3 gap-2 border p-3"><p>أيام الدراسة: {arabicNumber(rc.days_total)}</p><p>الحضور: {arabicNumber(rc.days_present)}</p><p>الغياب: {arabicNumber(rc.days_absent)}</p></div></section>
      <section className="report-comments space-y-2 text-sm"><div className="border p-3"><strong>ملاحظات المعلم: </strong><bdi>{arabicReportText(rc.teacher_remark)}</bdi></div><div className="border p-3"><strong>ملاحظات الإدارة: </strong><bdi>{arabicReportText(rc.principal_remark)}</bdi></div></section>
      <div className="grid grid-cols-3 gap-4 text-center text-sm">{['توقيع المعلم', 'توقيع الإدارة', 'توقيع ولي الأمر'].map((label, i) => <div key={label}><div className="flex h-14 items-center justify-center">{i === 1 && school.principal_signature_url && <img src={school.principal_signature_url} alt="توقيع الإدارة" className="max-h-12 max-w-28 object-contain" />}</div><p className="border-t pt-2">{label}</p></div>)}</div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-3 text-xs"><div>{school.stamp_url && <img src={school.stamp_url} alt="ختم المدرسة" className="max-h-16 max-w-28 object-contain" />}</div>{rc.verification_code && <p>رمز التحقق: <bdi>{rc.verification_code}</bdi></p>}{qrDataUrl && rc.verification_code && <img src={qrDataUrl} alt="رمز التحقق من النتيجة" className="h-14 w-14" />}</div>
    </div>
  </article>;
}