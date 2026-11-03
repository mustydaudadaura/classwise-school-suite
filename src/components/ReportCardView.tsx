import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { NigerianReportSheet } from '@/components/NigerianReportSheets';
import type { SchoolReport } from '@/components/SchoolReportLayouts';
import { REPORT_LANGUAGES, REPORT_LAYOUTS, resolveReportTemplate, type ReportLanguage, type ReportSheetId } from '@/lib/report-template';
import type { IslamiyyaAssessment } from '@/lib/islamiyya-report';

export function ReportCardView({ rc, assessments }: { rc: SchoolReport; assessments: IslamiyyaAssessment[] }) {
  const saved = resolveReportTemplate(rc.schools?.report_template, rc.classes?.section);
  const [design, setDesign] = useState<ReportSheetId | null>(null);
  const [language, setLanguage] = useState<ReportLanguage | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState('');
  useEffect(() => { setDesign(null); setLanguage(null); }, [saved.layout_id, saved.report_language]);
  useEffect(() => {
    let cancelled = false;
    setQrDataUrl('');
    if (rc.verification_code) {
      QRCode.toDataURL(`${window.location.origin}/verify/${encodeURIComponent(rc.verification_code)}`, { width: 120, margin: 1 })
        .then(url => { if (!cancelled) setQrDataUrl(url); }).catch(() => {});
    }
    return () => { cancelled = true; };
  }, [rc.verification_code]);
  const activeDesign = design ?? saved.layout_id;
  const activeLanguage = language ?? saved.report_language;
  return <div className="space-y-4 pb-8">
    <div className="print:hidden mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-3 border-b pb-3">
      <div className="flex w-full flex-wrap gap-2 sm:w-auto">
        <Select value={activeDesign} onValueChange={v => setDesign(v as ReportSheetId)}>
          <SelectTrigger aria-label="Report design" className="w-full sm:w-72"><SelectValue /></SelectTrigger>
          <SelectContent>{REPORT_LAYOUTS.map(l => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={activeLanguage} onValueChange={v => setLanguage(v as ReportLanguage)}>
          <SelectTrigger aria-label="Report language" className="w-full sm:w-44"><SelectValue /></SelectTrigger>
          <SelectContent>{REPORT_LANGUAGES.map(l => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      <Button onClick={() => window.print()}><Printer className="mr-2 h-4 w-4" />{activeLanguage === 'ar' ? 'طباعة / حفظ PDF' : activeLanguage === 'ha' ? 'Buga / Ajiye PDF' : 'Print / Save PDF'}</Button>
    </div>
    <div className="max-w-full overflow-x-auto"><NigerianReportSheet rc={rc} assessments={assessments} qrDataUrl={qrDataUrl} design={activeDesign} language={activeLanguage} /></div>
  </div>;
}
