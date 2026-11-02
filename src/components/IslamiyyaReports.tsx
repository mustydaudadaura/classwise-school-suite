import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { supabase } from '@/integrations/supabase/client';
import { getReportCardDetail } from '@/lib/api/results.functions';
import { IslamiyyaReportCard } from '@/components/IslamiyyaReportCard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Printer } from 'lucide-react';
import type { IslamiyyaAssessment, IslamiyyaProgress } from '@/lib/islamiyya-report';

export function IslamiyyaReports({ schoolId, currentSession, students, records }: {
  schoolId: string; currentSession: string | null;
  students: { id: string; first_name: string; middle_name: string | null; last_name: string; admission_no: string }[];
  records: (IslamiyyaProgress & { student_id: string; session: string; term: string })[];
}) {
  const [studentId, setStudentId] = useState('');
  const [session, setSession] = useState(currentSession ?? '');
  const [term, setTerm] = useState('First Term');
  const loadReport = useServerFn(getReportCardDetail);
  const reports = useQuery({
    queryKey: ['islamiyya-report', schoolId, studentId, session, term],
    enabled: !!studentId && !!session.trim(),
    queryFn: async () => {
      const { data, error } = await supabase.from('report_cards').select('id').eq('school_id', schoolId).eq('student_id', studentId).eq('session', session.trim()).eq('term', term).maybeSingle();
      if (error) throw error;
      return data ? loadReport({ data: { id: data.id } }) : null;
    },
  });
  return <div className="space-y-5">
    <div className="flex flex-wrap items-end gap-3 print:hidden">
      <div className="min-w-0 w-full space-y-2 sm:w-72"><Label htmlFor="islamiyya-student">Student / الطالب</Label><Select value={studentId} onValueChange={setStudentId}><SelectTrigger id="islamiyya-student"><SelectValue placeholder="Select student" /></SelectTrigger><SelectContent>{students.map(s => <SelectItem key={s.id} value={s.id}>{[s.first_name, s.middle_name, s.last_name].filter(Boolean).join(' ')} ({s.admission_no})</SelectItem>)}</SelectContent></Select></div>
      <div className="space-y-2"><Label htmlFor="islamiyya-session">Session / العام الدراسي</Label><Input id="islamiyya-session" value={session} onChange={e => setSession(e.target.value)} /></div>
      <div className="space-y-2"><Label htmlFor="islamiyya-term">Term / الفصل الدراسي</Label><Select value={term} onValueChange={setTerm}><SelectTrigger id="islamiyya-term"><SelectValue /></SelectTrigger><SelectContent>{['First Term', 'Second Term', 'Third Term'].map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent></Select></div>
      <Button disabled={!reports.data?.rc} onClick={() => window.print()}><Printer className="mr-2 h-4 w-4" />طباعة / حفظ PDF</Button>
    </div>
    {!studentId ? <p className="text-muted-foreground">Select a student.</p> : reports.isFetching ? <p role="status">Loading report…</p> : reports.error ? <p role="alert" className="text-destructive">{reports.error.message}</p> : !reports.data?.rc ? <p role="status" className="text-muted-foreground">No report card saved for this student, session and term.</p> :
      <div className="max-w-full overflow-x-auto"><IslamiyyaReportCard rc={reports.data.rc} assessments={reports.data.assessments as IslamiyyaAssessment[]} progress={records.filter(r => r.student_id === studentId && r.session === session.trim() && r.term === term)} /></div>}
  </div>;
}
