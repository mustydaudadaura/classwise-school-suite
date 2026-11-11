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
import { useServerFn } from '@tanstack/react-start';
import { readScoreSheet } from '@/lib/api/score-sheet-ai.functions';
import { FileDown, Printer, ScanLine } from 'lucide-react';

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
  const readSheet = useServerFn(readScoreSheet);
  const [reading, setReading] = useState(false);
  const [unclear, setUnclear] = useState<string[]>([]);
  const sorted = [...p.students].sort((a, b) => `${a.first_name} ${a.last_name}`.localeCompare(`${b.first_name} ${b.last_name}`, undefined, { sensitivity: 'base' }));
  const cols = config.ca2Max > 0 ? [config.ca1Label, config.ca2Label, config.examLabel, 'Total'] : [config.ca1Label, config.examLabel, 'Total'];
  const esc = (t: string) => t.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
  function printSheet() {
    const w = window.open('', '_blank');
    if (!w) { toast.error('Allow pop-ups to print the score sheet'); return; }
    const head = `<tr><th rowspan="2">S/N</th><th rowspan="2">Adm. no.</th><th rowspan="2">Student name</th>${p.subjects.map(s => `<th colspan="${cols.length}">${esc(s.name)}</th>`).join('')}</tr><tr>${p.subjects.map(() => cols.map(c => `<th>${esc(c)}</th>`).join('')).join('')}</tr>`;
    const body = sorted.map((st, i) => `<tr><td>${i + 1}</td><td>${esc(st.admission_no)}</td><td class="n">${esc(`${st.first_name} ${st.last_name}`)}</td>${p.subjects.map(() => cols.map(() => '<td></td>').join('')).join('')}</tr>`).join('');
    w.document.write(`<!doctype html><html><head><title>Score sheet</title><style>@page{size:A4 landscape;margin:8mm}body{font-family:Arial,sans-serif;font-size:11px}h1{font-size:15px;margin:0 0 4px}table{border-collapse:collapse;width:100%}th,td{border:1.5px solid #000;padding:5px 3px;text-align:center;height:22px}td.n{text-align:left;white-space:nowrap}tr{break-inside:avoid}</style></head><body><h1>Score sheet — ${esc(p.session)} ${esc(p.term)} term</h1><p>Max marks: ${cols.slice(0, -1).map((c, i) => `${esc(c)} ${[config.ca1Max, config.ca2Max > 0 ? config.ca2Max : null, config.examMax].filter(x => x !== null)[i]}`).join(' · ')}. Write clearly in each box with a pen.</p><table><thead>${head}</thead><tbody>${body}</tbody></table><p style="margin-top:14px">Teacher's signature: ____________________ &nbsp; Date: ____________</p><script>window.onload=()=>window.print()</script></body></html>`);
    w.document.close();
  }
  async function exportExcel() {
    const XLSX = await import('xlsx');
    const header = ['S/N', 'Admission no.', 'Student name', ...p.subjects.flatMap(s => cols.map(c => `${s.name} ${c}`))];
    const rows = sorted.map((st, i) => [i + 1, st.admission_no, `${st.first_name} ${st.last_name}`, ...p.subjects.flatMap(() => cols.map(() => ''))]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([header, ...rows]), 'Scores');
    XLSX.writeFile(wb, `score-sheet-${p.session.replace(/\W+/g, '-')}-${p.term}.xlsx`);
  }
  async function uploadSheet(file: File) {
    if (file.size > 10 * 1024 * 1024) { toast.error('File must be under 10 MB'); return; }
    setReading(true); setUnclear([]);
    try {
      const buf = new Uint8Array(await file.arrayBuffer());
      let bin = ''; for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
      const res = await readSheet({ data: { school_id: p.schoolId, class_id: p.classId, mime: file.type || 'image/jpeg', content: btoa(bin),
        students: sorted.map(s => ({ id: s.id, admission_no: s.admission_no, name: `${s.first_name} ${s.last_name}` })),
        subjects: p.subjects, maxes: { ca1: config.ca1Max, ca2: config.ca2Max, exam: config.examMax } } });
      const next: Record<string, EntryScore> = {};
      for (const r of res.scores) {
        const existing = results.data?.find(x => x.student_id === r.student_id && x.subject_id === r.subject_id);
        if (existing?.status === 'approved' && !p.canApprove) continue;
        next[key(r.student_id, r.subject_id)] = { ca1: r.ca1 ?? Number(existing?.ca1 ?? 0), ca2: r.ca2 ?? Number(existing?.ca2 ?? 0), exam: r.exam ?? Number(existing?.exam ?? 0) };
      }
      setChanges(prev => ({ ...prev, ...next }));
      setUnclear(res.unclear);
      toast.success(`${Object.keys(next).length} score(s) read from the sheet — check them, then press Final save`);
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Sheet could not be read'); }
    finally { setReading(false); }
  }
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
        return { school_id: p.schoolId, class_id: p.classId, student_id, subject_id, session: p.session, term: p.term, ...score, ca2: config.ca2Max > 0 ? score.ca2 : 0, grade: grade.grade, remark: grade.remark, status: 'submitted' as const };
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
    <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-lg font-semibold">General subject broadsheet</h2><div className="flex flex-wrap items-center gap-2"><Button variant="outline" size="sm" disabled={!sorted.length} onClick={printSheet}><Printer className="mr-1 h-4 w-4" />Print blank sheet</Button><Button variant="outline" size="sm" disabled={!sorted.length} onClick={exportExcel}><FileDown className="mr-1 h-4 w-4" />Export Excel</Button><Button asChild variant="outline" size="sm" disabled={reading || !sorted.length}><label className="cursor-pointer"><ScanLine className="mr-1 h-4 w-4" />{reading ? 'Reading sheet…' : 'Upload filled sheet (AI)'}<input type="file" accept="image/*,application/pdf" capture="environment" className="sr-only" disabled={reading} onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void uploadSheet(f); }} /></label></Button>{Object.keys(changes).length > 0 && <span className="text-xs text-muted-foreground">Draft kept on this device — saved automatically as you type</span>}<Button disabled={saving || !Object.keys(changes).length} onClick={save}>{saving ? 'Saving…' : `Final save (${Object.keys(changes).length})`}</Button></div></div>
    {unclear.length > 0 && <div role="status" className="rounded-md border border-border bg-muted p-3 text-sm"><p className="font-medium">The AI could not read these clearly — please type them in:</p><ul className="ml-4 list-disc">{unclear.map((u, i) => <li key={i}>{u}</li>)}</ul></div>}
    <Table>
      <TableHeader><TableRow><TableHead className="min-w-44">Student</TableHead>{p.subjects.map(s => <TableHead key={s.id} colSpan={config.ca2Max > 0 ? 4 : 3} className="border-l text-center">{s.name}</TableHead>)}</TableRow>
      <TableRow><TableHead>Admission no.</TableHead>{p.subjects.map(s => <TableHead key={s.id} colSpan={config.ca2Max > 0 ? 4 : 3} className="border-l"><div className={`grid gap-2 ${config.ca2Max > 0 ? 'min-w-88 grid-cols-4' : 'min-w-64 grid-cols-3'}`}><span>{config.ca1Label} ({config.ca1Max})</span>{config.ca2Max > 0 && <span>{config.ca2Label} ({config.ca2Max})</span>}<span>{config.examLabel} ({config.examMax})</span><span>Total</span></div></TableHead>)}</TableRow></TableHeader>
      <TableBody>{!p.students.length && <TableRow><TableCell colSpan={1 + p.subjects.length * (config.ca2Max > 0 ? 4 : 3)} className="text-muted-foreground">No active students in this class.</TableCell></TableRow>}{sorted.map(student => <TableRow key={student.id}><TableCell><div className="font-medium">{student.first_name} {student.last_name}</div><span className="text-xs text-muted-foreground">{student.admission_no}</span></TableCell>{p.subjects.map(subject => {
        const id = key(student.id, subject.id);
        const existing = results.data.find(r => r.student_id === student.id && r.subject_id === subject.id);
        const score = changes[id] ?? { ca1: Number(existing?.ca1 ?? 0), ca2: Number(existing?.ca2 ?? 0), exam: Number(existing?.exam ?? 0) };
        const fields = config.ca2Max > 0 ? ['ca1', 'ca2', 'exam'] as const : ['ca1', 'exam'] as const;
        return <TableCell key={subject.id} colSpan={config.ca2Max > 0 ? 4 : 3} className="border-l"><div className={`grid gap-2 ${config.ca2Max > 0 ? 'grid-cols-4' : 'grid-cols-3'}`}>{fields.map(field => <Input key={field} aria-label={`${student.first_name} ${student.last_name} ${subject.name} ${field.toUpperCase()}`} type="number" min={0} max={field === 'ca1' ? config.ca1Max : field === 'ca2' ? config.ca2Max : config.examMax} className="w-20" disabled={saving || (existing?.status === 'approved' && !p.canApprove)} value={changes[id] || existing ? score[field] : ''} onChange={e => setChanges(prev => ({ ...prev, [id]: { ...score, [field]: Number(e.target.value) } }))} />)}<span className="flex w-20 items-center justify-center font-semibold">{changes[id] || existing ? score.ca1 + (config.ca2Max > 0 ? score.ca2 : 0) + score.exam : '—'}</span></div>{existing && <p className="mt-1 text-xs text-muted-foreground">{existing.status === 'approved' ? 'Approved' : existing.status === 'submitted' ? 'Awaiting approval' : 'Returned'}</p>}</TableCell>;
      })}</TableRow>)}</TableBody>
    </Table>
  </section>;
}