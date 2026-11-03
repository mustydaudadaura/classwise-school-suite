import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { IslamiyyaReportCard } from '@/components/IslamiyyaReportCard';
import { SchoolReportLayouts, type SchoolReport } from '@/components/SchoolReportLayouts';
import { REPORT_LAYOUTS, resolveReportTemplate, islamiyyaLanguage, type ReportLayoutId } from '@/lib/report-template';
import type { IslamiyyaAssessment } from '@/lib/islamiyya-report';

export function ReportCardView({ rc, assessments }: { rc: SchoolReport; assessments: IslamiyyaAssessment[] }) {
  const savedLayout = resolveReportTemplate(rc.schools?.report_template, rc.classes?.section).layout_id;
  const [selectedLayout, setSelectedLayout] = useState<ReportLayoutId | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState('');
  useEffect(() => { setSelectedLayout(null); }, [savedLayout]);
  useEffect(() => {
    let cancelled = false;
    setQrDataUrl('');
    if (rc.verification_code) {
      QRCode.toDataURL(`${window.location.origin}/verify/${encodeURIComponent(rc.verification_code)}`, { width: 120, margin: 1 })
        .then(url => { if (!cancelled) setQrDataUrl(url); }).catch(() => {});
    }
    return () => { cancelled = true; };
  }, [rc.verification_code]);
  const layout = selectedLayout ?? savedLayout;
  const source = rc.schools?.report_template && typeof rc.schools.report_template === 'object' ? rc.schools.report_template : {};
  const report = { ...rc, schools: { ...rc.schools, report_template: { ...source, layout_id: layout } } };
  return <div className="space-y-4 pb-8">
    <div className="print:hidden mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-3 border-b pb-3">
      <Select value={layout} onValueChange={value => { if (REPORT_LAYOUTS.some(l => l.id === value)) setSelectedLayout(value as ReportLayoutId); }}>
        <SelectTrigger aria-label="Report display template" className="w-full sm:w-96"><SelectValue /></SelectTrigger><SelectContent>{REPORT_LAYOUTS.map(l => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}</SelectContent>
      </Select>
      <Button onClick={() => window.print()}><Printer className="mr-2 h-4 w-4" />{layout === 'islamiyya_arabic' ? 'طباعة / حفظ PDF' : 'Print / Save PDF'}</Button>
    </div>
    <div className="max-w-full overflow-x-auto">{islamiyyaLanguage(layout) ? <IslamiyyaReportCard rc={report} assessments={assessments} qrDataUrl={qrDataUrl} language={islamiyyaLanguage(layout)!} /> : <SchoolReportLayouts rc={report} assessments={assessments} qrDataUrl={qrDataUrl} />}</div>
  </div>;
}
