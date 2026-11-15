import { createFileRoute } from '@tanstack/react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useSchoolAccess } from '@/hooks/useSchoolAccess';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Printer, FileBadge } from 'lucide-react';
import { toast } from 'sonner';
import { yearlySummary, type TermReport } from '@/lib/yearly-summary';
import { ordinal, resolveRanking } from '@/lib/position-ranking';

export const Route = createFileRoute('/_authenticated/documents')({
  head: () => ({ meta: [
    { title: 'Certificates & Yearly Reports — Alegacy' },
    { name: 'description', content: 'Issue transfer and first school leaving certificates and print yearly summary reports.' },
    { property: 'og:title', content: 'Certificates & Yearly Reports — Alegacy' },
    { property: 'og:description', content: 'Transfer certificates, leaving certificates and yearly class summaries.' },
    { property: 'og:type', content: 'website' }, { name: 'twitter:card', content: 'summary' },
  ] }),
  component: DocumentsPage,
});

type Cert = { id: string; kind: string; serial_no: string; details: Record<string, string>; created_at: string; student_id: string };

function DocumentsPage() {
  const { schoolId } = useAuth();
  const { can, loading } = useSchoolAccess();
  if (!schoolId) return <p className="text-muted-foreground">Select a school at the top of the page.</p>;
  if (loading) return <p>Loading…</p>;
  if (!can('students.view')) return <p className="text-muted-foreground">You do not have access to this page.</p>;
  return <Docs key={schoolId} schoolId={schoolId} canIssue={can('students.edit')} />;
}

function Docs({ schoolId, canIssue }: { schoolId: string; canIssue: boolean }) {
  const qc = useQueryClient();
  const [printing, setPrinting] = useState<Cert | null>(null);
  const base = useQuery({ queryKey: ['documents', schoolId], queryFn: async () => {
    const [school, students, classes, certs] = await Promise.all([
      supabase.from('schools').select('*').eq('id', schoolId).single(),
      supabase.from('students').select('id,first_name,middle_name,last_name,admission_no,gender,dob,admission_date,class_id,state_of_origin,lga,status').eq('school_id', schoolId).order('last_name'),
      supabase.from('classes').select('id,name,section').eq('school_id', schoolId).order('name'),
      supabase.from('school_certificates').select('id,kind,serial_no,details,created_at,student_id').eq('school_id', schoolId).order('created_at', { ascending: false }).limit(100),
    ]);
    const err = [school, students, classes, certs].find(r => r.error)?.error; if (err) throw err;
    return { school: school.data!, students: students.data ?? [], classes: classes.data ?? [], certs: (certs.data ?? []) as Cert[] };
  } });
  if (base.isPending) return <p>Loading…</p>;
  if (base.error) return <p role="alert">{base.error.message}</p>;
  const { school, students, classes, certs } = base.data;
  const name = (id: string) => { const s = students.find(x => x.id === id); return s ? [s.first_name, s.middle_name, s.last_name].filter(Boolean).join(' ') : '—'; };

  if (printing) return <div className="space-y-4">
    <div className="flex gap-2 print:hidden"><Button variant="outline" onClick={() => setPrinting(null)}>Back</Button><Button onClick={() => window.print()}><Printer className="mr-2 h-4 w-4" />Print / Save PDF</Button></div>
    <CertificateSheet cert={printing} school={school} studentName={name(printing.student_id)} />
  </div>;

  return <div className="mx-auto max-w-5xl space-y-6">
    <h1 className="text-2xl font-bold">Certificates & reports</h1>
    <Tabs defaultValue="issue" className="space-y-6">
      <TabsList className="grid h-auto w-full grid-cols-3"><TabsTrigger value="issue">Issue certificate</TabsTrigger><TabsTrigger value="register">Issued register</TabsTrigger><TabsTrigger value="yearly">Yearly summary</TabsTrigger></TabsList>
      <TabsContent value="issue">{canIssue ? <IssueForm schoolId={schoolId} school={school} students={students} classes={classes} onIssued={async c => { await qc.invalidateQueries({ queryKey: ['documents', schoolId] }); setPrinting(c); }} /> : <p className="text-muted-foreground">Only staff who can edit student records can issue certificates.</p>}</TabsContent>
      <TabsContent value="register"><div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Serial no.</TableHead><TableHead>Type</TableHead><TableHead>Student</TableHead><TableHead>Issued</TableHead><TableHead /></TableRow></TableHeader><TableBody>
        {certs.map(c => <TableRow key={c.id}><TableCell className="font-mono">{c.serial_no}</TableCell><TableCell>{c.kind === 'transfer' ? 'Transfer' : 'First School Leaving'}</TableCell><TableCell>{name(c.student_id)}</TableCell><TableCell>{new Date(c.created_at).toLocaleDateString('en-NG')}</TableCell><TableCell><Button size="sm" variant="outline" onClick={() => setPrinting(c)}><Printer className="mr-1 h-4 w-4" />Reprint</Button></TableCell></TableRow>)}
        {!certs.length && <TableRow><TableCell colSpan={5} className="text-muted-foreground">No certificates issued yet</TableCell></TableRow>}
      </TableBody></Table></div></TabsContent>
      <TabsContent value="yearly"><YearlySummary schoolId={schoolId} school={school} classes={classes} students={students} /></TabsContent>
    </Tabs>
  </div>;
}

type School = { name: string; address: string | null; phone: string | null; motto: string | null; logo_url: string | null; principal_name: string | null; current_session: string | null; code: string };
type Student = { id: string; first_name: string; middle_name: string | null; last_name: string; admission_no: string; gender: string | null; dob: string | null; admission_date: string | null; class_id: string | null; state_of_origin: string | null; lga: string | null; status: string };

function IssueForm({ schoolId, school, students, classes, onIssued }: { schoolId: string; school: School; students: Student[]; classes: { id: string; name: string }[]; onIssued: (c: Cert) => void }) {
  const [kind, setKind] = useState<'transfer' | 'leaving'>('transfer');
  const [studentId, setStudentId] = useState('');
  const [busy, setBusy] = useState(false);
  const student = students.find(s => s.id === studentId);
  async function submit(form: FormData) {
    if (!student) return toast.error('Select a student');
    setBusy(true);
    try {
      const { data: auth } = await supabase.auth.getUser();
      const serial = `${kind === 'transfer' ? 'TC' : 'FSLC'}/${school.code}/${new Date().getFullYear()}/${Date.now().toString().slice(-6)}`;
      const details: Record<string, string> = Object.fromEntries([...form.entries()].map(([k, v]) => [k, String(v)]));
      Object.assign(details, { admission_no: student.admission_no, gender: student.gender ?? '', dob: student.dob ?? '', admission_date: student.admission_date ?? '', state_of_origin: [student.lga, student.state_of_origin].filter(Boolean).join(', '), last_class: classes.find(c => c.id === student.class_id)?.name ?? '' });
      const { data, error } = await supabase.from('school_certificates').insert({ school_id: schoolId, student_id: student.id, kind, serial_no: serial, details, issued_by: auth.user?.id }).select('id,kind,serial_no,details,created_at,student_id').single();
      if (error) throw error;
      toast.success('Certificate issued');
      onIssued(data as Cert);
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Could not issue certificate'); } finally { setBusy(false); }
  }
  return <form className="space-y-4" onSubmit={e => { e.preventDefault(); void submit(new FormData(e.currentTarget)); }}>
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="space-y-2"><Label>Certificate type</Label><Select value={kind} onValueChange={v => setKind(v as 'transfer' | 'leaving')}><SelectTrigger aria-label="Certificate type"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="transfer">Transfer certificate</SelectItem><SelectItem value="leaving">First School Leaving Certificate</SelectItem></SelectContent></Select></div>
      <div className="space-y-2"><Label>Student</Label><Select value={studentId} onValueChange={setStudentId}><SelectTrigger aria-label="Student"><SelectValue placeholder="Select student" /></SelectTrigger><SelectContent>{students.map(s => <SelectItem key={s.id} value={s.id}>{s.last_name} {s.first_name} ({s.admission_no})</SelectItem>)}</SelectContent></Select></div>
      <div className="space-y-2"><Label htmlFor="leaving_date">Date of leaving</Label><Input id="leaving_date" name="leaving_date" type="date" required defaultValue={new Date().toISOString().slice(0, 10)} /></div>
      <div className="space-y-2"><Label htmlFor="session">Session</Label><Input id="session" name="session" required defaultValue={school.current_session ?? ''} /></div>
      {kind === 'transfer' ? <>
        <div className="space-y-2"><Label htmlFor="new_school">School transferring to</Label><Input id="new_school" name="new_school" /></div>
        <div className="space-y-2"><Label htmlFor="reason">Reason for leaving</Label><Input id="reason" name="reason" placeholder="e.g. Parent relocation" /></div>
      </> : <>
        <div className="space-y-2"><Label htmlFor="class_completed">Class completed</Label><Input id="class_completed" name="class_completed" defaultValue="Primary 6" /></div>
        <div className="space-y-2"><Label htmlFor="result">Overall performance</Label><Input id="result" name="result" placeholder="e.g. Credit" /></div>
      </>}
      <div className="space-y-2"><Label htmlFor="conduct">Conduct</Label><Input id="conduct" name="conduct" defaultValue="Good" /></div>
      <div className="space-y-2"><Label htmlFor="fees_status">Fees status</Label><Input id="fees_status" name="fees_status" defaultValue="Cleared" /></div>
    </div>
    <div className="space-y-2"><Label htmlFor="remarks">Principal's remarks</Label><Textarea id="remarks" name="remarks" rows={2} /></div>
    <Button disabled={busy || !studentId}><FileBadge className="mr-2 h-4 w-4" />{busy ? 'Issuing…' : 'Issue & print'}</Button>
  </form>;
}

function CertificateSheet({ cert, school, studentName }: { cert: Cert; school: School; studentName: string }) {
  const d = cert.details; const date = (v?: string) => v ? new Date(v).toLocaleDateString('en-NG', { day: 'numeric', month: 'long', year: 'numeric' }) : '—';
  const rows: [string, string][] = [['Admission number', d.admission_no], ['Sex', d.gender], ['Date of birth', date(d.dob)], ['State / LGA of origin', d.state_of_origin], ['Date of admission', date(d.admission_date)], ['Date of leaving', date(d.leaving_date)], ['Session', d.session],
    ...(cert.kind === 'transfer' ? [['Last class attended', d.last_class], ['School transferring to', d.new_school], ['Reason for leaving', d.reason]] as [string, string][] : [['Class completed', d.class_completed], ['Overall performance', d.result]] as [string, string][]),
    ['Conduct', d.conduct], ['Fees status', d.fees_status]];
  return <div className="print-doc mx-auto max-w-3xl">
    <div className="cert-frame space-y-5 p-8 sm:p-12">
      <div className="text-center">{school.logo_url && <img src={school.logo_url} alt="" className="mx-auto mb-2 h-20 w-20 object-contain" />}<h2 className="text-2xl font-bold uppercase">{school.name}</h2><p className="text-sm">{school.address}{school.phone ? ` · ${school.phone}` : ''}</p>{school.motto && <p className="text-sm italic">“{school.motto}”</p>}</div>
      <h3 className="text-center text-xl font-bold uppercase tracking-wide underline">{cert.kind === 'transfer' ? 'Transfer Certificate' : 'First School Leaving Certificate'}</h3>
      <p className="text-right font-mono text-sm">No: {cert.serial_no}</p>
      <p className="leading-relaxed">This is to certify that <strong className="uppercase">{studentName}</strong> {cert.kind === 'transfer' ? 'was a bona fide student of this school and is hereby granted transfer.' : 'attended this school and has satisfactorily completed the primary school course.'}</p>
      <table className="w-full text-sm"><tbody>{rows.map(([k, v]) => <tr key={k} className="border-b border-dashed"><td className="py-1.5 pr-4 font-semibold">{k}</td><td className="py-1.5">{v || '—'}</td></tr>)}</tbody></table>
      {d.remarks && <p className="text-sm"><strong>Remarks:</strong> {d.remarks}</p>}
      <div className="flex justify-between pt-12 text-sm"><div className="text-center"><div className="w-48 border-t">Date: {date(cert.created_at)}</div></div><div className="text-center"><div className="w-48 border-t">{school.principal_name || 'Principal / Head Teacher'}</div><p>Signature & stamp</p></div></div>
    </div>
  </div>;
}

function YearlySummary({ schoolId, school, classes, students }: { schoolId: string; school: School; classes: { id: string; name: string }[]; students: Student[] }) {
  const [classId, setClassId] = useState('');
  const [session, setSession] = useState(school.current_session ?? '');
  const q = useQuery({ queryKey: ['yearly', schoolId, classId, session], enabled: Boolean(classId && session), queryFn: async () => {
    const { data, error } = await supabase.from('report_cards').select('student_id,term,average,total_score,days_present,days_total').eq('school_id', schoolId).eq('class_id', classId).eq('session', session);
    if (error) throw error; return (data ?? []) as TermReport[];
  } });
  const rows = q.data ? yearlySummary(q.data, resolveRanking((school as { report_template?: unknown } | null)?.report_template)) : [];
  const cls = classes.find(c => c.id === classId)?.name;
  const nm = (id: string) => { const s = students.find(x => x.id === id); return s ? `${s.last_name} ${s.first_name}` : '—'; };
  return <div className="space-y-4">
    <div className="grid gap-3 sm:grid-cols-3 print:hidden">
      <Select value={classId} onValueChange={setClassId}><SelectTrigger aria-label="Class"><SelectValue placeholder="Select class" /></SelectTrigger><SelectContent>{classes.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent></Select>
      <Input aria-label="Session" value={session} onChange={e => setSession(e.target.value)} placeholder="2025/2026" />
      <Button variant="outline" disabled={!rows.length} onClick={() => window.print()}><Printer className="mr-2 h-4 w-4" />Print summary</Button>
    </div>
    {!classId ? <p className="text-muted-foreground">Choose a class to see each student's three-term results.</p> : q.isPending ? <p>Loading…</p> : q.error ? <p role="alert">{q.error.message}</p> :
    <div className="print-doc overflow-x-auto">
      <div className="mb-3 text-center"><h2 className="text-lg font-bold uppercase">{school.name}</h2><p className="text-sm">Yearly summary — {cls} — {session} session</p></div>
      <Table><TableHeader><TableRow><TableHead>Pos.</TableHead><TableHead>Student</TableHead><TableHead className="text-right">1st term</TableHead><TableHead className="text-right">2nd term</TableHead><TableHead className="text-right">3rd term</TableHead><TableHead className="text-right">Yearly avg.</TableHead><TableHead className="text-right">Attendance</TableHead><TableHead>Decision</TableHead></TableRow></TableHeader><TableBody>
        {rows.map(r => <TableRow key={r.student_id}><TableCell>{r.position == null ? '—' : ordinal(r.position)}</TableCell><TableCell>{nm(r.student_id)}</TableCell>{(['first', 'second', 'third'] as const).map(t => <TableCell key={t} className="text-right">{r.terms[t]?.toFixed(1) ?? '—'}</TableCell>)}<TableCell className="text-right font-semibold">{r.average.toFixed(1)}</TableCell><TableCell className="text-right">{r.daysTotal ? `${r.daysPresent}/${r.daysTotal}` : '—'}</TableCell><TableCell>{r.average >= 40 ? 'Promoted' : 'Repeat / review'}</TableCell></TableRow>)}
        {!rows.length && <TableRow><TableCell colSpan={8} className="text-muted-foreground">No report cards for this class and session yet</TableCell></TableRow>}
      </TableBody></Table>
      {rows.length > 0 && <p className="mt-2 text-xs text-muted-foreground">Yearly average = average of the terms with results. Pass mark 40%. Class average: {(rows.reduce((a, r) => a + r.average, 0) / rows.length).toFixed(1)}</p>}
    </div>}
  </div>;
}
