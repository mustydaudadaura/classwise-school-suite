import type { CSSProperties, ReactNode } from 'react';
import { resolveReportTemplate, positionVisibility, type ReportLanguage, type ReportSheetId } from '@/lib/report-template';
import { islamiyyaTotals, arabicReportText, hausaReportText, type IslamiyyaAssessment } from '@/lib/islamiyya-report';
import type { SchoolReport } from '@/components/SchoolReportLayouts';

const L = {
  en: {
    report: 'PUPIL\'S PERFORMANCE REPORT', resultSheet: 'TERMLY PERFORMANCE RESULT SHEET', reportSheet: 'REPORT SHEET', caReport: 'CONTINUOUS ASSESSMENT REPORT',
    personal: 'PERSONAL DATA', name: 'Name', admission: 'Admission No', gender: 'Gender', klass: 'Class', dob: 'Date of Birth', session: 'Session', term: 'Term',
    attendance: 'ATTENDANCE', opened: 'No. of Times School Opened', present: 'No. of Times Present', absent: 'No. of Times Absent',
    summary: 'PERFORMANCE SUMMARY', obtainable: 'Total Score Obtainable', obtained: 'Total Score Obtained', average: 'Average (%)', position: 'Position', classSize: 'No. in Class',
    cognitive: 'COGNITIVE DOMAIN', subjects: 'SUBJECTS', ca1: 'C.A 1', ca2: 'C.A 2', ca: 'C.A', exam: 'EXAM', total: 'TOTAL', grade: 'GRADE', subjPos: 'POSITION', remark: 'REMARKS', rank: 'RANK',
    affective: 'AFFECTIVE DOMAIN', psychomotor: 'PSYCHOMOTOR SKILLS', gradeScale: 'GRADE SCALE', ratingKey: 'RATING KEY',
    teacher: "Class Teacher's Remark", principal: "Head Teacher's / Principal's Remark", sign: 'Signature', date: 'Date', nextTerm: 'Next Term Begins', promoted: 'Status', stamp: 'Stamp',
    noResults: 'No results recorded for this term.', verify: 'Verification code', marksObtainable: 'Total marks obtainable', marksObtained: 'Total marks obtained', percentage: 'Percentage',
    termNames: { first: 'FIRST TERM', second: 'SECOND TERM', third: 'THIRD TERM' } as Record<string, string>,
    ratings: ['Excellent', 'Very Good', 'Good', 'Fair', 'Poor'], score: 'Score', comments: 'Comments', parent: 'Parent / Guardian',
  },
  ar: {
    report: 'تقرير أداء التلميذ', resultSheet: 'كشف نتائج الفصل الدراسي', reportSheet: 'كشف التقرير', caReport: 'تقرير التقييم المستمر',
    personal: 'البيانات الشخصية', name: 'الاسم', admission: 'رقم القيد', gender: 'الجنس', klass: 'الصف', dob: 'تاريخ الميلاد', session: 'العام الدراسي', term: 'الفصل',
    attendance: 'الحضور', opened: 'عدد أيام الدراسة', present: 'عدد أيام الحضور', absent: 'عدد أيام الغياب',
    summary: 'ملخص الأداء', obtainable: 'الدرجة الكلية الممكنة', obtained: 'الدرجة المحصلة', average: 'المعدل (٪)', position: 'الترتيب', classSize: 'عدد طلاب الصف',
    cognitive: 'المجال المعرفي', subjects: 'المواد', ca1: 'تقييم ١', ca2: 'تقييم ٢', ca: 'التقييم', exam: 'الامتحان', total: 'المجموع', grade: 'التقدير', subjPos: 'الترتيب', remark: 'الملاحظات', rank: 'الترتيب',
    affective: 'المجال الوجداني', psychomotor: 'المهارات الحركية', gradeScale: 'سلم التقديرات', ratingKey: 'مفتاح التقييم',
    teacher: 'ملاحظات معلم الصف', principal: 'ملاحظات المدير', sign: 'التوقيع', date: 'التاريخ', nextTerm: 'بداية الفصل القادم', promoted: 'الحالة', stamp: 'الختم',
    noResults: 'لم تُسجَّل نتائج لهذا الفصل.', verify: 'رمز التحقق', marksObtainable: 'الدرجات الممكنة', marksObtained: 'الدرجات المحصلة', percentage: 'النسبة المئوية',
    termNames: { first: 'الفصل الدراسي الأول', second: 'الفصل الدراسي الثاني', third: 'الفصل الدراسي الثالث' } as Record<string, string>,
    ratings: ['ممتاز', 'جيد جداً', 'جيد', 'مقبول', 'ضعيف'], score: 'الدرجة', comments: 'التعليقات', parent: 'ولي الأمر',
  },
  ha: {
    report: 'RAHOTON CI GABAN ƊALIBI', resultSheet: 'TAKARDAR SAKAMAKON ZANGO', reportSheet: 'TAKARDAR RAHOTO', caReport: 'RAHOTON GWAJIN CI GABA',
    personal: 'BAYANAN ƊALIBI', name: 'Suna', admission: 'Lambar rijista', gender: 'Jinsi', klass: 'Aji', dob: 'Ranar haihuwa', session: 'Shekarar karatu', term: 'Zango',
    attendance: 'HALARTA', opened: 'Kwanakin buɗe makaranta', present: 'Kwanakin halarta', absent: 'Kwanakin rashin zuwa',
    summary: 'TAƘAITACCEN SAKAMAKO', obtainable: 'Jimillar maki mai yiwuwa', obtained: 'Jimillar maki da aka samu', average: 'Matsakaici (%)', position: 'Matsayi', classSize: 'Yawan ɗalibai a aji',
    cognitive: 'SASHEN ILIMI', subjects: 'DARUSSA', ca1: 'Gwaji 1', ca2: 'Gwaji 2', ca: 'Gwaji', exam: 'JARRABAWA', total: 'JIMILLA', grade: 'DARAJA', subjPos: 'MATSAYI', remark: 'BAYANI', rank: 'MATSAYI',
    affective: 'HALAYYA', psychomotor: 'ƘWARAREN HANNU', gradeScale: 'MA\'AUNIN DARAJA', ratingKey: 'MABUƊIN KIMANTAWA',
    teacher: "Ra'ayin malamin aji", principal: "Ra'ayin shugaban makaranta", sign: 'Sa hannu', date: 'Kwanan wata', nextTerm: 'Zango na gaba zai fara', promoted: 'Matsayi', stamp: 'Hatimi',
    noResults: 'Ba a shigar da sakamako na wannan zangon ba.', verify: 'Lambar tantancewa', marksObtainable: 'Maki mai yiwuwa', marksObtained: 'Maki da aka samu', percentage: 'Kashi',
    termNames: { first: 'ZANGON FARKO', second: 'ZANGO NA BIYU', third: 'ZANGO NA UKU' } as Record<string, string>,
    ratings: ['Kyakkyawa ƙwarai', 'Mai kyau sosai', 'Mai kyau', 'Matsakaici', 'Rauni'], score: 'Maki', comments: 'Ra\'ayoyi', parent: 'Iyaye / Mai kula',
  },
};

const TRAITS: Record<ReportLanguage, { affective: [string, string][]; psychomotor: [string, string][] }> = {
  en: {
    affective: [['attentiveness', 'Attentiveness'], ['honesty', 'Honesty'], ['neatness', 'Neatness'], ['politeness', 'Politeness'], ['punctuality', 'Punctuality'], ['self_control', 'Self Control'], ['obedience', 'Obedience'], ['reliability', 'Reliability'], ['relationship', 'Relationship with Others']],
    psychomotor: [['handwriting', 'Handwriting'], ['drawing', 'Drawing / Painting'], ['tools', 'Handling of Tools'], ['speech', 'Speech Fluency'], ['sports', 'Sports & Games'], ['music', 'Music']],
  },
  ar: {
    affective: [['attentiveness', 'الانتباه'], ['honesty', 'الأمانة'], ['neatness', 'النظافة'], ['politeness', 'الأدب'], ['punctuality', 'المواظبة'], ['self_control', 'ضبط النفس'], ['obedience', 'الطاعة'], ['reliability', 'الاعتماد عليه'], ['relationship', 'العلاقة مع الآخرين']],
    psychomotor: [['handwriting', 'الخط'], ['drawing', 'الرسم'], ['tools', 'استخدام الأدوات'], ['speech', 'طلاقة اللسان'], ['sports', 'الرياضة'], ['music', 'الأناشيد']],
  },
  ha: {
    affective: [['attentiveness', 'Kula'], ['honesty', 'Gaskiya'], ['neatness', 'Tsafta'], ['politeness', 'Ladabi'], ['punctuality', 'Zuwa a kan lokaci'], ['self_control', 'Kamun kai'], ['obedience', 'Biyayya'], ['reliability', 'Amana'], ['relationship', 'Zama da mutane']],
    psychomotor: [['handwriting', 'Rubutun hannu'], ['drawing', 'Zane'], ['tools', 'Amfani da kayan aiki'], ['speech', 'Iya magana'], ['sports', 'Wasanni'], ['music', 'Waƙoƙi']],
  },
};

const GRADE_SCALE: [string, string, string][] = [['A', '70 – 100', 'Excellent'], ['B', '60 – 69', 'Very Good'], ['C', '50 – 59', 'Good'], ['D', '45 – 49', 'Fair'], ['F', '0 – 44', 'Fail']];

export function NigerianReportSheet({ rc, assessments, qrDataUrl, design: designOverride, language: languageOverride }: { rc: SchoolReport; assessments: IslamiyyaAssessment[]; qrDataUrl?: string; design?: ReportSheetId; language?: ReportLanguage }) {
  const template = resolveReportTemplate(rc.schools?.report_template, rc.classes?.section);
  const design = designOverride ?? template.layout_id;
  const lang = languageOverride ?? template.report_language;
  const t = L[lang];
  const rtl = lang === 'ar';
  const tr = (v: string | null | undefined) => lang === 'ar' ? arabicReportText(v) : lang === 'ha' ? hausaReportText(v) : (v?.trim() || '—');
  const num = (v: number | string | null | undefined) => v == null || v === '' ? '—' : Number.isFinite(Number(v)) ? new Intl.NumberFormat(rtl ? 'ar-EG' : 'en-NG', { maximumFractionDigits: 2 }).format(Number(v)) : String(v);
  const school = rc.schools ?? {};
  const student = rc.students ?? {};
  const schoolName = (rtl && template.arabic_school_name) || school.name || '';
  const address = (rtl && template.arabic_address) || school.address || '';
  const fullName = [student.last_name, student.first_name, student.middle_name].filter(Boolean).join(' ').toUpperCase();
  const className = [rc.classes?.name, rc.classes?.arm].filter(Boolean).join(' ');
  const termName = rc.term ? (t.termNames[rc.term] ?? rc.term) : '';
  const positions = positionVisibility(template.positions);
  const totals = islamiyyaTotals(assessments);
  const obtainable = assessments.length * 100;
  const pct = totals.total != null && obtainable ? (totals.total / obtainable) * 100 : null;
  const gender = student.gender ? (lang === 'ar' ? (student.gender === 'male' ? 'ذكر' : 'أنثى') : lang === 'ha' ? (student.gender === 'male' ? 'Namiji' : 'Mace') : student.gender.toUpperCase()) : '—';

  // Colours are the school's chosen report palette tokens so screen, print and PDF match.
  const c = (part: keyof typeof template) => `var(--report-colour-${template[part]})`;
  const primary = c('heading'), line = c('border'), head = c('table');
  const cell: CSSProperties = { border: `1px solid ${line}`, padding: '2px 4px', fontSize: 10.5, lineHeight: 1.25, textAlign: rtl ? 'right' : 'left', verticalAlign: 'middle' };
  const th: CSSProperties = { ...cell, fontWeight: 700, background: `color-mix(in oklab, ${head} 18%, white)`, textAlign: 'center' };
  const tc: CSSProperties = { ...cell, textAlign: 'center' };
  const boxTitle = (text: string, filled = false): CSSProperties => ({ ...th, background: filled ? head : th.background, color: filled ? 'white' : undefined, fontSize: 11 });
  const sheet: CSSProperties = { width: 794, minHeight: 1123, margin: '0 auto', background: 'white', color: '#111', padding: 22, position: 'relative', fontFamily: rtl ? "'Amiri', 'Noto Naskh Arabic', serif" : 'inherit', direction: rtl ? 'rtl' : 'ltr', border: design === 'sheet_hisgrace' ? `3px solid ${line}` : `1px solid ${line}`, boxSizing: 'border-box' };

  const Logo = ({ size = 82 }: { size?: number }) => school.logo_url ? <img src={school.logo_url} alt="School logo" crossOrigin="anonymous" style={{ width: size, height: size, objectFit: 'contain' }} /> : <div style={{ width: size, height: size }} />;
  const Photo = ({ w = 82, h = 96 }: { w?: number; h?: number }) => <div style={{ width: w, height: h, border: `1px solid ${line}`, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', fontSize: 9, color: '#777' }}>{student.photo_url ? <img src={student.photo_url} alt="Student passport" crossOrigin="anonymous" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : 'Passport'}</div>;
  const Watermark = () => school.logo_url ? <img src={school.logo_url} alt="" aria-hidden="true" crossOrigin="anonymous" style={{ position: 'absolute', inset: 0, margin: 'auto', width: 420, opacity: 0.06, pointerEvents: 'none' }} /> : null;
  const Table = ({ children, style }: { children: ReactNode; style?: CSSProperties }) => <table style={{ width: '100%', borderCollapse: 'collapse', ...style }}><tbody>{children}</tbody></table>;
  const KV = ({ rows }: { rows: [string, ReactNode][] }) => <>{rows.map(([k, v]) => <tr key={k}><td style={{ ...cell, fontWeight: 700, width: '45%' }}>{k}</td><td style={cell}>{v}</td></tr>)}</>;

  const traitValue = (group: 'affective' | 'psychomotor', key: string) => { const v = rc[group]?.[key]; return v == null ? null : Number(v); };
  const TickGrid = ({ group, title }: { group: 'affective' | 'psychomotor'; title: string }) => (
    <Table><tr><td style={{ ...boxTitle(title, design === 'sheet_alqalam') }}>{title}</td>{[5, 4, 3, 2, 1].map(n => <td key={n} style={{ ...th, width: 18 }}>{num(n)}</td>)}</tr>
      {TRAITS[lang][group].map(([key, label]) => { const v = traitValue(group, key); return <tr key={key}><td style={cell}>{label}</td>{[5, 4, 3, 2, 1].map(n => <td key={n} style={tc}>{v === n ? '✓' : ''}</td>)}</tr>; })}
    </Table>);
  const ScoreGrid = ({ group, title }: { group: 'affective' | 'psychomotor'; title: string }) => (
    <Table><tr><td style={th}>{title}</td><td style={{ ...th, width: 60 }}>{t.score}</td></tr>
      {TRAITS[lang][group].map(([key, label]) => <tr key={key}><td style={cell}>{label}</td><td style={tc}>{num(traitValue(group, key))}</td></tr>)}
    </Table>);
  const GradeScale = () => <Table><tr><td colSpan={3} style={boxTitle(t.gradeScale, true)}>{t.gradeScale}</td></tr>{GRADE_SCALE.map(([g, r, word]) => <tr key={g}><td style={tc}>{g}</td><td style={tc}>{r}</td><td style={cell}>{tr(word)}</td></tr>)}</Table>;
  const RatingKey = () => <div style={{ fontSize: 9.5, marginTop: 4 }}><strong>{t.ratingKey}:</strong> {t.ratings.map((r, i) => `${num(5 - i)} = ${r}`).join(' · ')}</div>;
  const Sig = ({ url }: { url?: string | null }) => url ? <img src={url} alt="" crossOrigin="anonymous" style={{ height: 26, maxWidth: 110, objectFit: 'contain', verticalAlign: 'middle' }} /> : <span style={{ display: 'inline-block', width: 110, borderBottom: '1px solid #555' }} />;
  const Verify = () => <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 9 }}>{qrDataUrl && rc.verification_code && <img src={qrDataUrl} alt="Verify report" style={{ width: 62, height: 62 }} />}{rc.verification_code && <span>{t.verify}: <bdi>{rc.verification_code}</bdi></span>}</div>;
  const Stamp = () => school.stamp_url ? <img src={school.stamp_url} alt="School stamp" crossOrigin="anonymous" style={{ height: 70, maxWidth: 110, objectFit: 'contain', opacity: 0.9 }} /> : null;

  const results = (cols: 'alqalam' | 'emerald' | 'hisgrace' | 'fmp') => (
    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
      <thead>
        <tr>
          <th style={{ ...th, textAlign: rtl ? 'right' : 'left', fontSize: cols === 'hisgrace' ? 15 : 11 }}>{t.subjects}</th>
          {cols === 'fmp' ? <><th style={th}>{t.ca} (20)</th><th style={th}>{t.ca} (20)</th></> : <><th style={th}>{t.ca1}<br />20</th><th style={th}>{t.ca2}<br />20</th></>}
          <th style={th}>{t.exam}<br />60</th><th style={th}>{t.total}<br />100</th>
          {cols === 'emerald' && positions.subject && <th style={th}>{t.rank}</th>}
          {cols !== 'emerald' && positions.subject && <th style={th}>{t.subjPos}</th>}
          <th style={th}>{t.grade}</th><th style={th}>{t.remark}</th>
        </tr>
      </thead>
      <tbody>
        {assessments.map((a, i) => <tr key={a.id} style={cols === 'fmp' && i % 2 ? { background: `color-mix(in oklab, ${c('rows')} 10%, white)` } : undefined}>
          <td style={{ ...cell, fontWeight: 700, textTransform: 'uppercase' }}>{lang === 'ar' ? arabicReportText(a.subjects?.name) : (a.subjects?.name ?? '—')}</td>
          <td style={tc}>{num(a.ca1)}</td><td style={tc}>{num(a.ca2)}</td><td style={tc}>{num(a.exam)}</td><td style={{ ...tc, fontWeight: 700 }}>{num(a.total)}</td>
          {positions.subject && <td style={tc}>{num(a.subject_position)}</td>}
          <td style={tc}>{a.grade ?? '—'}</td><td style={tc}>{tr(a.remark)}</td>
        </tr>)}
        {!assessments.length && <tr><td colSpan={9} style={{ ...tc, padding: 12 }}>{t.noResults}</td></tr>}
      </tbody>
    </table>);

  const remarks = <Table>
    <tr><td style={{ ...cell, fontWeight: 700, width: '28%' }}>{t.teacher}</td><td style={cell}>{rc.teacher_remark || '—'}</td><td style={{ ...cell, width: 130 }}>{t.sign}: <Sig /></td></tr>
    <tr><td style={{ ...cell, fontWeight: 700 }}>{t.principal}</td><td style={cell}>{rc.principal_remark || '—'}{school.principal_name ? <div style={{ fontSize: 9, marginTop: 2 }}>{school.principal_name}</div> : null}</td><td style={cell}>{t.sign}: <Sig url={school.principal_signature_url} /></td></tr>
  </Table>;

  const attendanceRows: [string, ReactNode][] = [[t.opened, num(rc.days_total)], [t.present, num(rc.days_present)], [t.absent, num(rc.days_absent)]];
  const summaryRows: [string, ReactNode][] = [[t.obtainable, num(obtainable || null)], [t.obtained, num(totals.total)], [t.average, num(pct)], ...(positions.class ? [[t.position, num(rc.position)] as [string, ReactNode]] : []), [t.classSize, num(rc.class_size)]];

  let body: ReactNode;
  if (design === 'sheet_emerald') {
    body = <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: head, color: 'white', padding: '8px 10px', borderBottom: `5px solid ${primary}` }}>
        <div style={{ background: 'white', borderRadius: 6, padding: 2 }}><Logo size={72} /></div>
        <div style={{ flex: 1, textAlign: 'center' }}>
          <div style={{ fontSize: 24, fontWeight: 900, letterSpacing: 1 }}>{schoolName.toUpperCase()}</div>
          {school.motto && <div style={{ fontStyle: 'italic', fontSize: 11 }}>...{school.motto}</div>}
          <div style={{ fontSize: 10 }}>{address}</div>
        </div>
        <div style={{ background: 'white' }}><Photo w={70} h={82} /></div>
      </div>
      <h2 style={{ textAlign: 'center', fontSize: 16, fontWeight: 900, margin: '10px 0 6px', color: primary }}>{t.resultSheet}</h2>
      <Table style={{ marginBottom: 6 }}>
        <tr><td style={{ ...cell, fontWeight: 700 }}>{t.name}</td><td style={cell}>{fullName || '—'}</td><td style={{ ...cell, fontWeight: 700 }}>{t.classSize}</td><td style={cell}>{num(rc.class_size)}</td><td style={{ ...cell, fontWeight: 700 }}>{t.term}</td><td style={cell}>{termName}</td></tr>
        <tr><td style={{ ...cell, fontWeight: 700 }}>{t.admission}</td><td style={cell}>{student.admission_no ?? '—'}</td><td style={{ ...cell, fontWeight: 700 }}>{t.dob}</td><td style={cell}>{student.dob ?? '—'}</td><td style={{ ...cell, fontWeight: 700 }}>{t.session}</td><td style={cell}>{rc.session ?? '—'}</td></tr>
        <tr><td style={{ ...cell, fontWeight: 700 }}>{t.klass}</td><td style={cell}>{className || '—'}</td><td style={{ ...cell, fontWeight: 700 }}>{t.gender}</td><td style={cell}>{gender}</td><td style={{ ...cell, fontWeight: 700 }}>{t.nextTerm}</td><td style={cell}>—</td></tr>
      </Table>
      {results('emerald')}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 8 }}>
        <Table><KV rows={summaryRows} /></Table>
        <Table><tr><td colSpan={2} style={boxTitle(t.attendance, true)}>{t.attendance}</td></tr><KV rows={attendanceRows} /></Table>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 90px 1fr', gap: 8, marginTop: 8, alignItems: 'start' }}>
        <ScoreGrid group="psychomotor" title={t.psychomotor} />
        <div style={{ textAlign: 'center' }}>{qrDataUrl && <img src={qrDataUrl} alt="Verify report" style={{ width: 86, height: 86 }} />}</div>
        <ScoreGrid group="affective" title={t.affective} />
      </div>
      <RatingKey />
      <div style={{ marginTop: 8 }}>{remarks}</div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}><Verify /><Stamp /></div>
    </>;
  } else if (design === 'sheet_hisgrace') {
    body = <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, borderBottom: `3px solid ${line}`, paddingBottom: 8 }}>
        <Logo size={96} />
        <div style={{ flex: 1, textAlign: 'center' }}>
          <div style={{ fontSize: 26, fontWeight: 900, color: primary }}>{schoolName.toUpperCase()}</div>
          {rc.classes?.section && <div style={{ fontSize: 11 }}>({rc.classes.section.toUpperCase()})</div>}
          <div style={{ fontSize: 11 }}>{address}</div>
          {school.motto && <div style={{ fontSize: 11 }}>{school.motto}</div>}
        </div>
        <Photo w={88} h={100} />
      </div>
      <h2 style={{ textAlign: 'center', fontSize: 17, fontWeight: 900, margin: '8px 0' }}>{rc.session ?? ''} {termName} {t.reportSheet}</h2>
      <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 1fr 0.8fr', gap: 8 }}>
        <Table><tr><td colSpan={2} style={boxTitle(t.personal)}>{t.personal}</td></tr><KV rows={[[t.name, fullName || '—'], [t.dob, student.dob ?? '—'], [t.gender, gender], [t.klass, className || '—'], [t.admission, student.admission_no ?? '—']]} /></Table>
        <Table><tr><td colSpan={3} style={boxTitle(t.attendance)}>{t.attendance}</td></tr><tr>{attendanceRows.map(([k]) => <td key={k} style={{ ...tc, fontSize: 9.5 }}>{k}</td>)}</tr><tr>{attendanceRows.map(([k, v]) => <td key={k} style={{ ...tc, fontWeight: 700 }}>{v}</td>)}</tr></Table>
        <Table><KV rows={summaryRows} /></Table>
      </div>
      <div style={{ ...boxTitle(t.cognitive), border: `1px solid ${line}`, marginTop: 8 }}>{t.cognitive}</div>
      {results('hisgrace')}
      <div style={{ ...boxTitle(t.gradeScale), border: `1px solid ${line}`, marginTop: 8 }}>{t.gradeScale}</div>
      <Table><tr>{GRADE_SCALE.map(([g, r, w]) => <td key={g} style={{ ...tc, fontSize: 9.5 }}>{r} ({g} – {tr(w)})</td>)}</tr></Table>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 8 }}>
        <TickGrid group="affective" title={t.affective} />
        <div><TickGrid group="psychomotor" title={t.psychomotor} /><RatingKey /></div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 120px', gap: 8, marginTop: 8, border: `2px solid ${line}`, padding: 6, alignItems: 'center' }}>
        <div style={{ fontSize: 11, lineHeight: 1.9 }}>
          <div><strong>{t.teacher}:</strong> {rc.teacher_remark || '—'} &nbsp; {t.sign}: <Sig /></div>
          <div><strong>{t.principal}:</strong> {rc.principal_remark || '—'} &nbsp; {t.sign}: <Sig url={school.principal_signature_url} /></div>
          <Verify />
        </div>
        <div style={{ textAlign: 'center' }}><Stamp /></div>
      </div>
    </>;
  } else if (design === 'sheet_fmp') {
    const shade = `color-mix(in oklab, ${head} 14%, white)`;
    const sc: CSSProperties = { ...cell, background: shade, fontWeight: 700 };
    body = <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <Photo w={80} h={80} />
        <div style={{ flex: 1, textAlign: 'center' }}>
          <div style={{ fontSize: 24, fontWeight: 900, color: primary, fontFamily: rtl ? undefined : 'Georgia, serif' }}>{schoolName.toUpperCase()}</div>
          <div style={{ fontSize: 12, marginTop: 4 }}>{address}</div>
          <div style={{ fontSize: 15, fontWeight: 800, marginTop: 8 }}>{t.caReport} — {termName} {rc.session ?? ''}</div>
        </div>
        <Logo size={80} />
      </div>
      <Table style={{ marginTop: 10 }}>
        <tr><td style={sc}>{t.name}</td><td colSpan={3} style={cell}>{fullName || '—'}</td></tr>
        <tr><td style={sc}>{t.klass}</td><td style={cell}>{className || '—'}</td><td style={sc}>{t.gender}</td><td style={cell}>{gender}</td></tr>
        <tr><td style={sc}>{t.admission}</td><td style={cell}>{student.admission_no ?? '—'}</td><td style={sc}>{t.classSize}</td><td style={cell}>{num(rc.class_size)}</td></tr>
        <tr><td style={sc}>{t.opened}</td><td style={cell}>{num(rc.days_total)}</td><td style={sc}>{t.present} / {t.absent}</td><td style={cell}>{num(rc.days_present)} / {num(rc.days_absent)}</td></tr>
      </Table>
      <div style={{ marginTop: 6 }}>{results('fmp')}</div>
      <Table><tr><td style={sc}>{t.marksObtainable}: {num(obtainable || null)}</td><td style={sc}>{t.marksObtained}: {num(totals.total)}</td><td style={sc}>{t.percentage}: {num(pct)}%</td>{positions.class && <td style={sc}>{t.position}: {num(rc.position)}</td>}</tr></Table>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', marginTop: 6 }}>
        <ScoreGrid group="psychomotor" title={t.psychomotor} />
        <ScoreGrid group="affective" title={t.affective} />
      </div>
      <RatingKey />
      <Table style={{ marginTop: 6 }}>
        <tr><td style={sc}>{t.teacher}</td><td colSpan={2} style={cell}>{rc.teacher_remark || '—'}</td></tr>
        <tr><td style={sc}>{t.sign}</td><td style={cell}><Sig /></td><td style={cell}>{t.date}:</td></tr>
        <tr><td style={sc}>{t.principal}</td><td colSpan={2} style={cell}>{rc.principal_remark || '—'}</td></tr>
        <tr><td style={sc}>{school.principal_name || t.sign}</td><td style={cell}><Sig url={school.principal_signature_url} /></td><td style={cell}>{t.date}:</td></tr>
      </Table>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}><Verify /><Stamp /></div>
    </>;
  } else {
    body = <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <Logo size={92} />
        <div style={{ flex: 1, textAlign: 'center' }}>
          <div style={{ fontSize: 26, fontWeight: 900, color: primary }}>{schoolName.toUpperCase()}</div>
          {school.motto && <div style={{ fontSize: 11, fontWeight: 700 }}>{school.motto}</div>}
          <div style={{ fontSize: 11 }}>{address}</div>
          <div style={{ fontSize: 14, fontWeight: 900, marginTop: 6, textDecoration: 'underline' }}>{rc.session ?? ''} – {termName} {t.report}</div>
        </div>
        <Photo />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1.15fr 1fr 1fr', gap: 8, marginTop: 8 }}>
        <Table><tr><td colSpan={2} style={boxTitle(t.personal)}>{t.personal}</td></tr><KV rows={[[t.name, fullName || '—'], [t.admission, student.admission_no ?? '—'], [t.gender, gender], [t.klass, className || '—'], [t.dob, student.dob ?? '—']]} /></Table>
        <Table><tr><td colSpan={3} style={boxTitle(t.attendance)}>{t.attendance}</td></tr><tr>{attendanceRows.map(([k]) => <td key={k} style={{ ...tc, fontSize: 9.5 }}>{k}</td>)}</tr><tr>{attendanceRows.map(([k, v]) => <td key={k} style={{ ...tc, fontWeight: 700 }}>{v}</td>)}</tr></Table>
        <Table><tr><td colSpan={2} style={boxTitle(t.summary)}>{t.summary}</td></tr><KV rows={summaryRows} /></Table>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 230px', gap: 8, marginTop: 8, alignItems: 'start' }}>
        <div><div style={{ ...boxTitle(t.cognitive), border: `1px solid ${line}` }}>{t.cognitive}</div>{results('alqalam')}</div>
        <div style={{ display: 'grid', gap: 8 }}>
          <TickGrid group="affective" title={t.affective} />
          <TickGrid group="psychomotor" title={t.psychomotor} />
          <GradeScale />
          <RatingKey />
        </div>
      </div>
      <div style={{ marginTop: 8 }}>{remarks}</div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}><Verify /><Stamp /></div>
    </>;
  }

  return <article className="print-doc report-sheet" style={sheet} dir={rtl ? 'rtl' : 'ltr'} lang={lang} data-report-layout={design} aria-label={`${schoolName} ${t.report}`}>
    <Watermark />
    <div style={{ position: 'relative', zIndex: 1 }}>{body}</div>
  </article>;
}
