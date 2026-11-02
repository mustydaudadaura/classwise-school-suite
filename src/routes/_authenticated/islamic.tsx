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
import { Badge } from '@/components/ui/badge';
import { MoonStar, Printer } from 'lucide-react';
import { toast } from 'sonner';
import { IslamiyyaReports } from '@/components/IslamiyyaReports';

export const Route = createFileRoute('/_authenticated/islamic')({
  head: () => ({ meta: [
    { title: 'Islamic Programmes — Alegacy' },
    { name: 'description', content: 'Manage Tahfiz, Arabic and Islamiyya programmes, enrolments and memorisation records.' },
    { property: 'og:title', content: 'Islamic Programmes — Alegacy' },
    { property: 'og:description', content: 'Tahfiz tracking, Arabic and Islamic programme management for schools.' },
    { property: 'og:type', content: 'website' }, { name: 'twitter:card', content: 'summary' },
  ] }),
  component: IslamicPage,
});

type Programme = { id: string; name: string; programme_type: string; description: string | null; active: boolean };
type Enrollment = { id: string; programme_id: string; student_id: string; status: string; enrolled_at: string };
type TahfizRecord = { id: string; student_id: string; session: string; term: string; record_date: string; surah_from: string; ayah_from: number; surah_to: string; ayah_to: number; assessment_type: string; score: number | null; grade: string | null; remarks: string | null };
type Student = { id: string; first_name: string; middle_name: string | null; last_name: string; admission_no: string; class_id: string | null; status: string };

const TYPE_LABEL: Record<string, string> = { tahfiz: 'Tahfiz (Qur’an memorisation)', arabic: 'Arabic language', islamiyya: 'Islamiyya / Tarbiyya', other: 'Other' };

function IslamicPage() {
  const { schoolId } = useAuth();
  const { can, loading } = useSchoolAccess();
  if (!schoolId) return <p className="text-muted-foreground">Select a school at the top of the page.</p>;
  if (loading) return <p>Loading…</p>;
  if (!can('academics.view')) return <p className="text-muted-foreground">You do not have access to this page.</p>;
  return <Islamic key={schoolId} schoolId={schoolId} canEdit={can('academics.edit')} />;
}

function Islamic({ schoolId, canEdit }: { schoolId: string; canEdit: boolean }) {
  const qc = useQueryClient();
  const [printStudent, setPrintStudent] = useState<string | null>(null);
  const base = useQuery({ queryKey: ['islamic', schoolId], queryFn: async () => {
    const [school, programmes, enrollments, records, students] = await Promise.all([
      supabase.from('schools').select('name,logo_url,current_session').eq('id', schoolId).single(),
      supabase.from('islamic_programmes').select('id,name,programme_type,description,active').eq('school_id', schoolId).order('name'),
      supabase.from('islamic_enrollments').select('id,programme_id,student_id,status,enrolled_at').eq('school_id', schoolId),
      supabase.from('tahfiz_records').select('id,student_id,session,term,record_date,surah_from,ayah_from,surah_to,ayah_to,assessment_type,score,grade,remarks').eq('school_id', schoolId).order('record_date', { ascending: false }).limit(500),
      supabase.from('students').select('id,first_name,middle_name,last_name,admission_no,class_id,status').eq('school_id', schoolId).order('last_name'),
    ]);
    const err = [school, programmes, enrollments, records, students].find(r => r.error)?.error; if (err) throw err;
    if (!school.data) throw new Error('School not found');
    return { school: school.data, programmes: (programmes.data ?? []) as Programme[], enrollments: (enrollments.data ?? []) as Enrollment[], records: (records.data ?? []) as TahfizRecord[], students: (students.data ?? []) as Student[] };
  } });
  if (base.isPending) return <p>Loading…</p>;
  if (base.error) return <p role="alert">{base.error.message}</p>;
  const { school, programmes, enrollments, records, students } = base.data;
  const refresh = () => qc.invalidateQueries({ queryKey: ['islamic', schoolId] });
  const studentName = (id: string) => { const s = students.find(x => x.id === id); return s ? [s.first_name, s.middle_name, s.last_name].filter(Boolean).join(' ') : '—'; };
  const programmeName = (id: string) => programmes.find(p => p.id === id)?.name ?? '—';

  if (printStudent && students.some(s => s.id === printStudent)) {
    const st = students.find(s => s.id === printStudent);
    const stuRecords = records.filter(r => r.student_id === printStudent);
    return <div className="space-y-4">
      <div className="flex gap-2 print:hidden"><Button variant="outline" onClick={() => setPrintStudent(null)}>Back</Button><Button onClick={() => window.print()}><Printer className="mr-2 h-4 w-4" />Print / Save PDF</Button></div>
      <div className="mx-auto max-w-3xl space-y-4 rounded-lg border bg-card p-8 print:border-0">
        <div className="flex items-center gap-3 border-b pb-4">
          {school.logo_url && <img src={school.logo_url} alt="" className="h-14 w-14 object-contain" />}
          <div><h2 className="text-xl font-bold">{school.name}</h2><p className="text-sm text-muted-foreground">Tahfiz progress report — {school.current_session ?? ''}</p></div>
        </div>
        <p className="font-semibold">{studentName(printStudent)} <span className="font-normal text-muted-foreground">({st?.admission_no})</span></p>
        <Table><TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Portion</TableHead><TableHead>Type</TableHead><TableHead>Score</TableHead><TableHead>Grade</TableHead><TableHead>Remarks</TableHead></TableRow></TableHeader><TableBody>
          {stuRecords.map(r => <TableRow key={r.id}><TableCell>{new Date(r.record_date).toLocaleDateString('en-NG')}</TableCell><TableCell>{r.surah_from} {r.ayah_from} – {r.surah_to} {r.ayah_to}</TableCell><TableCell className="capitalize">{r.assessment_type}</TableCell><TableCell>{r.score ?? '—'}</TableCell><TableCell>{r.grade ?? '—'}</TableCell><TableCell>{r.remarks ?? ''}</TableCell></TableRow>)}
          {!stuRecords.length && <TableRow><TableCell colSpan={6} className="text-muted-foreground">No records yet</TableCell></TableRow>}
        </TableBody></Table>
      </div>
    </div>;
  }

  return <div className="mx-auto max-w-6xl space-y-6">
    <div className="flex items-center gap-3">
      <MoonStar className="h-7 w-7 text-primary" />
      <div><h1 className="text-2xl font-bold">Islamic programmes</h1><p className="text-sm text-muted-foreground">Tahfiz, Arabic and Islamiyya programmes, enrolment and memorisation records.</p></div>
    </div>
    <Tabs defaultValue="programmes" className="space-y-6">
      <TabsList className="grid h-auto w-full grid-cols-2 sm:grid-cols-5">
        <TabsTrigger value="programmes">Programmes</TabsTrigger>
        <TabsTrigger value="enrolment">Enrolment</TabsTrigger>
        <TabsTrigger value="tahfiz">Tahfiz records</TabsTrigger>
        <TabsTrigger value="progress">Progress</TabsTrigger>
        <TabsTrigger value="arabic-reports">Islamiyya reports / العربية</TabsTrigger>
      </TabsList>

      <TabsContent value="arabic-reports"><IslamiyyaReports schoolId={schoolId} currentSession={school.current_session} students={students} records={records} /></TabsContent>
      <TabsContent value="programmes" className="space-y-4">
        {canEdit && <ProgrammeForm schoolId={schoolId} onSaved={refresh} />}
        <div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Type</TableHead><TableHead>Description</TableHead><TableHead>Status</TableHead>{canEdit && <TableHead />}</TableRow></TableHeader><TableBody>
          {programmes.map(p => <TableRow key={p.id}><TableCell className="font-medium">{p.name}</TableCell><TableCell>{TYPE_LABEL[p.programme_type] ?? p.programme_type}</TableCell><TableCell className="max-w-xs truncate">{p.description ?? ''}</TableCell><TableCell><Badge variant={p.active ? 'default' : 'secondary'}>{p.active ? 'Active' : 'Closed'}</Badge></TableCell>
            {canEdit && <TableCell><Button size="sm" variant="outline" onClick={async () => { const { error } = await supabase.from('islamic_programmes').update({ active: !p.active }).eq('id', p.id); if (error) toast.error(error.message); else { toast.success(p.active ? 'Programme closed' : 'Programme reopened'); refresh(); } }}>{p.active ? 'Close' : 'Reopen'}</Button></TableCell>}</TableRow>)}
          {!programmes.length && <TableRow><TableCell colSpan={5} className="text-muted-foreground">No programmes yet — add one above.</TableCell></TableRow>}
        </TableBody></Table></div>
      </TabsContent>

      <TabsContent value="enrolment" className="space-y-4">
        {canEdit && <EnrolForm schoolId={schoolId} programmes={programmes.filter(p => p.active)} students={students} onSaved={refresh} />}
        <div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Student</TableHead><TableHead>Programme</TableHead><TableHead>Enrolled</TableHead><TableHead>Status</TableHead>{canEdit && <TableHead />}</TableRow></TableHeader><TableBody>
          {enrollments.map(e => <TableRow key={e.id}><TableCell>{studentName(e.student_id)}</TableCell><TableCell>{programmeName(e.programme_id)}</TableCell><TableCell>{new Date(e.enrolled_at).toLocaleDateString('en-NG')}</TableCell><TableCell><Badge variant={e.status === 'active' ? 'default' : 'secondary'} className="capitalize">{e.status}</Badge></TableCell>
            {canEdit && <TableCell className="space-x-1">{e.status === 'active' && <><Button size="sm" variant="outline" onClick={async () => { const { error } = await supabase.from('islamic_enrollments').update({ status: 'completed' }).eq('id', e.id); if (error) toast.error(error.message); else refresh(); }}>Complete</Button><Button size="sm" variant="ghost" onClick={async () => { const { error } = await supabase.from('islamic_enrollments').update({ status: 'withdrawn' }).eq('id', e.id); if (error) toast.error(error.message); else refresh(); }}>Withdraw</Button></>}</TableCell>}</TableRow>)}
          {!enrollments.length && <TableRow><TableCell colSpan={5} className="text-muted-foreground">No enrolments yet.</TableCell></TableRow>}
        </TableBody></Table></div>
      </TabsContent>

      <TabsContent value="tahfiz" className="space-y-4">
        {canEdit && <TahfizForm schoolId={schoolId} school={school} students={students} onSaved={refresh} />}
        <div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Student</TableHead><TableHead>Portion</TableHead><TableHead>Type</TableHead><TableHead>Score</TableHead><TableHead>Grade</TableHead></TableRow></TableHeader><TableBody>
          {records.slice(0, 100).map(r => <TableRow key={r.id}><TableCell>{new Date(r.record_date).toLocaleDateString('en-NG')}</TableCell><TableCell>{studentName(r.student_id)}</TableCell><TableCell>{r.surah_from} {r.ayah_from} – {r.surah_to} {r.ayah_to}</TableCell><TableCell className="capitalize">{r.assessment_type}</TableCell><TableCell>{r.score ?? '—'}</TableCell><TableCell>{r.grade ?? '—'}</TableCell></TableRow>)}
          {!records.length && <TableRow><TableCell colSpan={6} className="text-muted-foreground">No Tahfiz records yet.</TableCell></TableRow>}
        </TableBody></Table></div>
      </TabsContent>

      <TabsContent value="progress" className="space-y-4">
        <p className="text-sm text-muted-foreground">Per-student memorisation summary. Print a full report for any student.</p>
        <div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Student</TableHead><TableHead>Records</TableHead><TableHead>Latest portion</TableHead><TableHead>Average score</TableHead><TableHead /></TableRow></TableHeader><TableBody>
          {students.filter(s => records.some(r => r.student_id === s.id)).map(s => {
            const rs = records.filter(r => r.student_id === s.id);
            const scored = rs.filter(r => r.score != null);
            const avg = scored.length ? (scored.reduce((a, r) => a + Number(r.score), 0) / scored.length).toFixed(1) : '—';
            const latest = rs[0];
            return <TableRow key={s.id}><TableCell>{studentName(s.id)}</TableCell><TableCell>{rs.length}</TableCell><TableCell>{latest ? `${latest.surah_from} ${latest.ayah_from} – ${latest.surah_to} ${latest.ayah_to}` : '—'}</TableCell><TableCell>{avg}</TableCell><TableCell><Button size="sm" variant="outline" onClick={() => setPrintStudent(s.id)}><Printer className="mr-1 h-4 w-4" />Report</Button></TableCell></TableRow>;
          })}
          {!records.length && <TableRow><TableCell colSpan={5} className="text-muted-foreground">No records to summarise yet.</TableCell></TableRow>}
        </TableBody></Table></div>
      </TabsContent>
    </Tabs>
  </div>;
}

function ProgrammeForm({ schoolId, onSaved }: { schoolId: string; onSaved: () => void }) {
  const [busy, setBusy] = useState(false);
  async function submit(form: FormData) {
    setBusy(true);
    const { error } = await supabase.from('islamic_programmes').insert({
      school_id: schoolId,
      name: String(form.get('name') || '').trim(),
      programme_type: String(form.get('programme_type') || 'tahfiz'),
      description: String(form.get('description') || '').trim() || null,
    });
    setBusy(false);
    if (error) toast.error(error.message); else { toast.success('Programme added'); onSaved(); }
  }
  return <form action={submit} className="grid gap-3 rounded-lg border bg-card p-4 sm:grid-cols-4">
    <div className="space-y-1"><Label htmlFor="prog-name">Programme name</Label><Input id="prog-name" name="name" required placeholder="e.g. Tahfizul Qur’an" /></div>
    <div className="space-y-1"><Label htmlFor="prog-type">Type</Label><Select name="programme_type" defaultValue="tahfiz"><SelectTrigger id="prog-type"><SelectValue /></SelectTrigger><SelectContent>{Object.entries(TYPE_LABEL).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}</SelectContent></Select></div>
    <div className="space-y-1 sm:col-span-2"><Label htmlFor="prog-desc">Description (optional)</Label><Input id="prog-desc" name="description" placeholder="Short note about this programme" /></div>
    <div className="sm:col-span-4"><Button type="submit" disabled={busy}>{busy ? 'Saving…' : 'Add programme'}</Button></div>
  </form>;
}

function EnrolForm({ schoolId, programmes, students, onSaved }: { schoolId: string; programmes: Programme[]; students: Student[]; onSaved: () => void }) {
  const [busy, setBusy] = useState(false);
  async function submit(form: FormData) {
    setBusy(true);
    const { error } = await supabase.from('islamic_enrollments').insert({
      school_id: schoolId,
      programme_id: String(form.get('programme_id')),
      student_id: String(form.get('student_id')),
    });
    setBusy(false);
    if (error) toast.error(error.code === '23505' ? 'That student is already enrolled in this programme' : error.message);
    else { toast.success('Student enrolled'); onSaved(); }
  }
  if (!programmes.length) return <p className="text-sm text-muted-foreground">Add an active programme first.</p>;
  return <form action={submit} className="grid gap-3 rounded-lg border bg-card p-4 sm:grid-cols-3">
    <div className="space-y-1"><Label htmlFor="en-prog">Programme</Label><Select name="programme_id" required><SelectTrigger id="en-prog"><SelectValue placeholder="Select programme" /></SelectTrigger><SelectContent>{programmes.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent></Select></div>
    <div className="space-y-1"><Label htmlFor="en-stu">Student</Label><Select name="student_id" required><SelectTrigger id="en-stu"><SelectValue placeholder="Select student" /></SelectTrigger><SelectContent>{students.filter(s => s.status === 'active').map(s => <SelectItem key={s.id} value={s.id}>{[s.first_name, s.last_name].join(' ')} ({s.admission_no})</SelectItem>)}</SelectContent></Select></div>
    <div className="flex items-end"><Button type="submit" disabled={busy}>{busy ? 'Enrolling…' : 'Enrol student'}</Button></div>
  </form>;
}

function TahfizForm({ schoolId, school, students, onSaved }: { schoolId: string; school: { current_session: string | null }; students: Student[]; onSaved: () => void }) {
  const [busy, setBusy] = useState(false);
  async function submit(form: FormData) {
    const scoreRaw = String(form.get('score') || '').trim();
    setBusy(true);
    const { error } = await supabase.from('tahfiz_records').insert({
      school_id: schoolId,
      student_id: String(form.get('student_id')),
      session: String(form.get('session') || school.current_session || '').trim(),
      term: String(form.get('term') || 'First Term'),
      record_date: String(form.get('record_date') || new Date().toISOString().slice(0, 10)),
      surah_from: String(form.get('surah_from') || '').trim(),
      ayah_from: Number(form.get('ayah_from') || 1),
      surah_to: String(form.get('surah_to') || '').trim(),
      ayah_to: Number(form.get('ayah_to') || 1),
      assessment_type: String(form.get('assessment_type') || 'memorization'),
      score: scoreRaw ? Number(scoreRaw) : null,
      grade: String(form.get('grade') || '').trim() || null,
      remarks: String(form.get('remarks') || '').trim() || null,
    });
    setBusy(false);
    if (error) toast.error(error.message); else { toast.success('Tahfiz record saved'); onSaved(); }
  }
  return <form action={submit} className="grid gap-3 rounded-lg border bg-card p-4 sm:grid-cols-4">
    <div className="space-y-1 sm:col-span-2"><Label htmlFor="tf-stu">Student</Label><Select name="student_id" required><SelectTrigger id="tf-stu"><SelectValue placeholder="Select student" /></SelectTrigger><SelectContent>{students.filter(s => s.status === 'active').map(s => <SelectItem key={s.id} value={s.id}>{[s.first_name, s.last_name].join(' ')} ({s.admission_no})</SelectItem>)}</SelectContent></Select></div>
    <div className="space-y-1"><Label htmlFor="tf-date">Date</Label><Input id="tf-date" name="record_date" type="date" defaultValue={new Date().toISOString().slice(0, 10)} required /></div>
    <div className="space-y-1"><Label htmlFor="tf-type">Assessment</Label><Select name="assessment_type" defaultValue="memorization"><SelectTrigger id="tf-type"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="memorization">Memorisation (Hifz)</SelectItem><SelectItem value="tajweed">Tajweed</SelectItem><SelectItem value="revision">Revision (Muraja’a)</SelectItem></SelectContent></Select></div>
    <div className="space-y-1"><Label htmlFor="tf-sf">From surah</Label><Input id="tf-sf" name="surah_from" required placeholder="e.g. Al-Baqarah" /></div>
    <div className="space-y-1"><Label htmlFor="tf-af">From ayah</Label><Input id="tf-af" name="ayah_from" type="number" min={1} defaultValue={1} required /></div>
    <div className="space-y-1"><Label htmlFor="tf-st">To surah</Label><Input id="tf-st" name="surah_to" required placeholder="e.g. Al-Baqarah" /></div>
    <div className="space-y-1"><Label htmlFor="tf-at">To ayah</Label><Input id="tf-at" name="ayah_to" type="number" min={1} defaultValue={10} required /></div>
    <div className="space-y-1"><Label htmlFor="tf-session">Session</Label><Input id="tf-session" name="session" defaultValue={school.current_session ?? ''} required /></div>
    <div className="space-y-1"><Label htmlFor="tf-term">Term</Label><Select name="term" defaultValue="First Term"><SelectTrigger id="tf-term"><SelectValue /></SelectTrigger><SelectContent>{['First Term', 'Second Term', 'Third Term'].map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent></Select></div>
    <div className="space-y-1"><Label htmlFor="tf-score">Score (0–100)</Label><Input id="tf-score" name="score" type="number" min={0} max={100} step="0.5" placeholder="Optional" /></div>
    <div className="space-y-1"><Label htmlFor="tf-grade">Grade</Label><Input id="tf-grade" name="grade" placeholder="e.g. Excellent" /></div>
    <div className="space-y-1 sm:col-span-4"><Label htmlFor="tf-remarks">Remarks</Label><Textarea id="tf-remarks" name="remarks" rows={2} placeholder="Teacher’s remarks (optional)" /></div>
    <div className="sm:col-span-4"><Button type="submit" disabled={busy}>{busy ? 'Saving…' : 'Save record'}</Button></div>
  </form>;
}
