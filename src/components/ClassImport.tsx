import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Copy, Layers } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import type { Tables } from '@/integrations/supabase/types';
import { prepareClassImport, prepareSubjectCopy, verifyImportedRows } from '@/lib/class-import';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export function ClassImport({ kind, schoolId, classes, subjects }: {
  kind: 'classes' | 'subjects'; schoolId: string; classes: Tables<'classes'>[]; subjects: Tables<'subjects'>[];
}) {
  const qc = useQueryClient();
  const [sourceId, setSourceId] = useState('');
  const [names, setNames] = useState('');
  const [targets, setTargets] = useState<string[]>([]);
  const [filter, setFilter] = useState('');
  const [saving, setSaving] = useState(false);
  useEffect(() => { setSourceId(''); setNames(''); setTargets([]); setFilter(''); }, [schoolId]);
  const active = classes.filter(c => c.active);
  const destinations = active.filter(c => c.id !== sourceId);
  const visibleDestinations = destinations.filter(c => c.name.toLocaleLowerCase().includes(filter.toLocaleLowerCase()));
  const source = active.find(c => c.id === sourceId);
  const subjectCount = subjects.filter(s => s.active && s.class_id === sourceId).length;
  let preview: { rows: unknown[]; skipped: number } | undefined;
  try {
    preview = kind === 'classes' ? prepareClassImport(names, schoolId, classes, sourceId) : prepareSubjectCopy(schoolId, sourceId, targets, classes, subjects);
  } catch { /* Incomplete form has no preview. Validation runs on submission. */ }

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    try {
      // Re-read the school's registries so recent additions are also skipped.
      const [classResult, subjectResult] = await Promise.all([
        supabase.from('classes').select('*').eq('school_id', schoolId),
        supabase.from('subjects').select('*').eq('school_id', schoolId),
      ]);
      if (classResult.error) throw classResult.error;
      if (subjectResult.error) throw subjectResult.error;
      const currentClasses = classResult.data ?? [];
      const currentSubjects = subjectResult.data ?? [];
      let saved = 0;
      let skipped = 0;
      if (kind === 'classes') {
        const result = prepareClassImport(names, schoolId, currentClasses, sourceId);
        skipped = result.skipped;
        if (result.rows.length) {
          const { data, error } = await supabase.from('classes').insert(result.rows).select('id, school_id');
          if (error) throw error;
          verifyImportedRows(data, result.rows.length, schoolId);
          saved = result.rows.length;
        }
      } else {
        const result = prepareSubjectCopy(schoolId, sourceId, targets, currentClasses, currentSubjects);
        skipped = result.skipped;
        if (result.rows.length) {
          const { data, error } = await supabase.from('subjects').insert(result.rows).select('id, school_id');
          if (error) throw error;
          verifyImportedRows(data, result.rows.length, schoolId);
          saved = result.rows.length;
        }
      }
      await Promise.all(['classes', 'subjects', 'classes-for-students'].map(key => qc.invalidateQueries({ queryKey: [key] })));
      toast.success(`${saved} ${kind === 'classes' ? 'classes added' : 'subjects copied'}${skipped ? `; ${skipped} existing records skipped` : ''}`);
      if (kind === 'classes') setNames('');
      else setTargets([]);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : (error as { message?: string }).message ?? 'Import could not be saved');
    } finally { setSaving(false); }
  };

  return (
    <section className="space-y-4 border-y border-border py-5">
      <h2 className="flex items-center gap-2 text-lg font-semibold">{kind === 'classes' ? <Layers className="size-5" /> : <Copy className="size-5" />}{kind === 'classes' ? 'Import classes' : 'Copy subjects from another class'}</h2>
      <form onSubmit={save} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor={`source-${kind}`}>Source class</Label>
            <Select value={sourceId || undefined} onValueChange={value => { setSourceId(value); setTargets(targets.filter(id => id !== value)); }} disabled={saving}>
              <SelectTrigger id={`source-${kind}`}><SelectValue placeholder="Choose source class" /></SelectTrigger>
              <SelectContent>{active.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
            </Select>
            {source && <p className="text-sm text-muted-foreground">{kind === 'classes' ? `${source.level ?? 'No level'} · ${source.arm ?? 'No arm'} · ${source.section ?? 'No section'}` : `${subjectCount} active subjects`}</p>}
          </div>
          {kind === 'classes' ? <div className="space-y-2"><Label htmlFor="import-class-names">New class names (one per line)</Label><Textarea id="import-class-names" value={names} onChange={e => setNames(e.target.value)} placeholder={'Primary 2\nPrimary 3\nPrimary 4'} rows={5} required disabled={saving} /></div> :
            <fieldset className="min-w-0 space-y-2" disabled={saving}>
              <legend className="mb-2 text-sm font-medium">Destination classes</legend>
              <Input aria-label="Find destination class" placeholder="Find class…" value={filter} onChange={e => setFilter(e.target.value)} />
              <div className="flex items-center gap-2"><Checkbox id="all-copy-targets" checked={destinations.length > 0 && destinations.every(c => targets.includes(c.id))} onCheckedChange={checked => setTargets(checked === true ? destinations.map(c => c.id) : [])} /><Label htmlFor="all-copy-targets">Select all ({destinations.length})</Label></div>
              <div className="max-h-48 space-y-2 overflow-y-auto py-2">{visibleDestinations.map(c => <div key={c.id} className="flex items-center gap-2"><Checkbox id={`copy-${c.id}`} checked={targets.includes(c.id)} onCheckedChange={checked => setTargets(checked === true ? [...targets, c.id] : targets.filter(id => id !== c.id))} /><Label htmlFor={`copy-${c.id}`} className="break-words">{c.name}</Label></div>)}{!visibleDestinations.length && <p className="text-sm text-muted-foreground">No destination classes</p>}</div>
            </fieldset>}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" disabled={saving || !sourceId || (kind === 'classes' ? !names.trim() : !targets.length)}><Copy className="mr-2 size-4" />{saving ? 'Saving…' : kind === 'classes' ? 'Import classes' : 'Copy subjects'}</Button>
          {preview && <p role="status" className="text-sm text-muted-foreground">{preview.rows.length} to add · {preview.skipped} existing records skipped</p>}
        </div>
      </form>
    </section>
  );
}