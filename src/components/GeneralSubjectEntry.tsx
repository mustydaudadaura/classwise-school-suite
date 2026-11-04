import { useEffect, useState } from 'react';
import { loadScoreDraft, saveScoreDraft, scoreDraftKey } from '@/lib/score-drafts';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { calculateGrade, CA_RATIOS, type CaRatioType, type GradingScaleType } from '@/lib/grading';
import { validateBroadsheet, type EntryScore } from '@/lib/broadsheet';
import { toast } from 'sonner';

type Props = {
  schoolId: string; classId: string; session: string; term: 'first' | 'second' | 'third';
  students: { id: string; admission_no: string; first_name: string; last_name: string }[];
  subjects: { id: string; name: string }[];
  ratio: CaRatioType; scale: GradingScaleType; canApprove: boolean;
};
export function GeneralSubjectEntry(p: Props) {
  const qc = useQueryClient();
  const config = CA_RATIOS[p.ratio];
  const [changes, setChanges] = useState<Record<string, EntryScore>>({});
  const [saving, setSaving] = useState(false);
  // Device draft: unsaved broadsheet cells survive leaving the tab until the final save.
  const draftKey = scoreDraftKey(['broadsheet', p.schoolId, p.classId, p.session, p.term]);
  const [restored, setRestored] = useState(false);
  useEffect(() => {
    const draft = loadScoreDraft(draftKey);
    setChanges(Object.fromEntries(Object.entries(draft).filter(([id]) => { const [st, sub] = id.split(':'); return p.students.some(s => s.id === st) && p.subjects.some(s => s.id === sub); })));
    setRestored(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftKey]);
  useEffect(() => { if (restored) saveScoreDraft(draftKey, changes); }, [restored, draftKey, changes]);
  const results = useQuery({
    queryKey: ['assessments', 'broadsheet', p.schoolId, p.classId, p.session, p.term],
    queryFn: async () => {
      const { data, error } = await supabase.from('assessments').select('*').eq('school_id', p.schoolId).eq('class_id', p.classId).eq('session', p.session).eq('term', p.term);
      if (error) throw error;
      return data ?? [];
    },
  });
  const key = (student: string, subject: string) => `${student}:${subject}`;
  async function save() {
    setSaving(true);
    try {
      validateBroadsheet(Object.values(changes), p.ratio);
      const rows = Object.entries(changes).map(([id, score]) => {
        const [student_id, subject_id] = id.split(':');
        if (!p.students.some(s => s.id === student_id) || !p.subjects.some(s => s.id === subject_id)) throw new Error('Choose students and subjects in this class');
        const total = score.ca1 + (config.ca2Max > 0 ? score.ca2 : 0) + score.exam;
        const grade = calculateGrade(total, p.scale);
        return { school_id: p.schoolId, class_id: p.classId, student_id, subject_id, session: p.session, term: p.term, ...score, ca2: config.ca2Max > 0 ? score.ca2 : 0, total, grade: grade.grade, remark: grade.remark, status: 'submitted' as const };
      });
      const { data, error } = await supabase.from('assessments').upsert(rows, { onConflict: 'student_id,subject_id,session,term' }).select('student_id,subject_id,ca1,ca2,exam,status');
      if (error) throw error;
      if (data?.length !== rows.length || rows.some(row => !data.some(saved => saved.student_id === row.student_id && saved.subject_id === row.subject_id && Number(saved.ca1) === row.ca1 && Number(saved.ca2) === row.ca2 && Number(saved.exam) === row.exam && saved.status === 'submitted'))) throw new Error('Saved scores could not be confirmed');
      setChanges({});
      await qc.invalidateQueries({ queryKey: ['assessments'] });
      toast.success(`${rows.length} subject score(s) saved — awaiting approval`);
    } catch (error) { toast.error(error instanceof Error ? error.message : (error as { message?: string }).message ?? 'Scores could not be saved'); }
    finally { setSaving(false); }
  }
  if (results.error) return <p role="alert" className="text-destructive">Scores could not be loaded: {results.error.message}</p>;
  if (results.isPending) return <p>Loading scores…</p>;
  return <section className="space-y-3">
    <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-lg font-semibold">General subject broadsheet</h2><div className="flex flex-wrap items-center gap-2">{Object.keys(changes).length > 0 && <span className="text-xs text-muted-foreground">Draft kept on this device — saved automatically as you type</span>}<Button disabled={saving || !Object.keys(changes).length} onClick={save}>{saving ? 'Saving…' : `Final save (${Object.keys(changes).length})`}</Button></div></div>
    <Table>
      <TableHeader><TableRow><TableHead className="min-w-44">Student</TableHead>{p.subjects.map(s => <TableHead key={s.id} colSpan={config.ca2Max > 0 ? 4 : 3} className="border-l text-center">{s.name}</TableHead>)}</TableRow>
      <TableRow><TableHead>Admission no.</TableHead>{p.subjects.map(s => <TableHead key={s.id} colSpan={config.ca2Max > 0 ? 4 : 3} className="border-l"><div className={`grid gap-2 ${config.ca2Max > 0 ? 'min-w-88 grid-cols-4' : 'min-w-64 grid-cols-3'}`}><span>{config.ca1Label} ({config.ca1Max})</span>{config.ca2Max > 0 && <span>{config.ca2Label} ({config.ca2Max})</span>}<span>{config.examLabel} ({config.examMax})</span><span>Total</span></div></TableHead>)}</TableRow></TableHeader>
      <TableBody>{!p.students.length && <TableRow><TableCell colSpan={1 + p.subjects.length * (config.ca2Max > 0 ? 4 : 3)} className="text-muted-foreground">No active students in this class.</TableCell></TableRow>}{p.students.map(student => <TableRow key={student.id}><TableCell><div className="font-medium">{student.first_name} {student.last_name}</div><span className="text-xs text-muted-foreground">{student.admission_no}</span></TableCell>{p.subjects.map(subject => {
        const id = key(student.id, subject.id);
        const existing = results.data.find(r => r.student_id === student.id && r.subject_id === subject.id);
        const score = changes[id] ?? { ca1: Number(existing?.ca1 ?? 0), ca2: Number(existing?.ca2 ?? 0), exam: Number(existing?.exam ?? 0) };
        const fields = config.ca2Max > 0 ? ['ca1', 'ca2', 'exam'] as const : ['ca1', 'exam'] as const;
        return <TableCell key={subject.id} colSpan={config.ca2Max > 0 ? 4 : 3} className="border-l"><div className={`grid gap-2 ${config.ca2Max > 0 ? 'grid-cols-4' : 'grid-cols-3'}`}>{fields.map(field => <Input key={field} aria-label={`${student.first_name} ${student.last_name} ${subject.name} ${field.toUpperCase()}`} type="number" min={0} max={field === 'ca1' ? config.ca1Max : field === 'ca2' ? config.ca2Max : config.examMax} className="w-20" disabled={saving || (existing?.status === 'approved' && !p.canApprove)} value={changes[id] || existing ? score[field] : ''} onChange={e => setChanges(prev => ({ ...prev, [id]: { ...score, [field]: Number(e.target.value) } }))} />)}<span className="flex w-20 items-center justify-center font-semibold">{changes[id] || existing ? score.ca1 + (config.ca2Max > 0 ? score.ca2 : 0) + score.exam : '—'}</span></div>{existing && <p className="mt-1 text-xs text-muted-foreground">{existing.status === 'approved' ? 'Approved' : existing.status === 'submitted' ? 'Awaiting approval' : 'Returned'}</p>}</TableCell>;
      })}</TableRow>)}</TableBody>
    </Table>
  </section>;
}