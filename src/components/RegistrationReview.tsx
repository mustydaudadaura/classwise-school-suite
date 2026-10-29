import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Pencil, XCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { verifyRegistrationReview } from '@/lib/registration-review';

type Kind = 'classes' | 'subjects' | 'students';
export function RegistrationReview({ kind, id, name, editOnly = false }: { kind: Kind; id: string; name: string; editOnly?: boolean }) {
  const qc = useQueryClient();
  const [mode, setMode] = useState<'edit' | 'reject' | null>(null);
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [values, setValues] = useState<Record<string, string>>({});
  const [reason, setReason] = useState('');
  const [classes, setClasses] = useState<{ id: string; name: string }[]>([]);
  const [previous, setPrevious] = useState({ active: false, pending_activation: true });
  const fields = kind === 'classes' ? ['name', 'level', 'arm', 'section'] : kind === 'subjects' ? ['name', 'code', 'class_id'] : ['admission_no', 'first_name', 'last_name', 'middle_name', 'gender', 'dob', 'class_id'];
  const labels: Record<string, string> = { name: 'Name', level: 'Level', arm: 'Arm', section: 'Section', code: 'Subject code', class_id: 'Class', admission_no: 'Admission number', first_name: 'First name', last_name: 'Last name', middle_name: 'Middle name', gender: 'Gender', dob: 'Date of birth' };
  async function open(next: 'edit' | 'reject') {
    setMode(next); setLoaded(false); setReason(''); setBusy(true);
    try {
      const { data, error } = await supabase.from(kind).select('*').eq('id', id).single();
      if (error) throw error;
      if (next === 'reject' && (!data.pending_activation || data.active)) throw new Error('This registration is no longer awaiting approval');
      setPrevious({ active: data.active, pending_activation: data.pending_activation });
      const record = data as unknown as Record<string, unknown>;
      setValues(Object.fromEntries(fields.map(key => [key, String(record[key] ?? '')])));
      if (kind !== 'classes') {
        const choices = await supabase.from('classes').select('id,name').eq('school_id', data.school_id).eq('active', true).eq('pending_activation', false).order('name');
        if (choices.error) throw choices.error;
        setClasses(choices.data ?? []);
      }
      setLoaded(true);
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Could not load registration'); setMode(null); }
    finally { setBusy(false); }
  }
  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!mode || busy || !loaded) return;
    setBusy(true);
    try {
      const changes = Object.fromEntries(fields.map(key => [key, values[key]?.trim() || null]));
      const { data, error } = await supabase.rpc('review_pending_registration', { _table: kind, _id: id, _action: mode, _changes: mode === 'edit' ? changes : {}, _reason: mode === 'reject' ? reason.trim() : undefined });
      if (error) throw error;
      verifyRegistrationReview(data, id, mode, changes, previous);
      await qc.invalidateQueries();
      toast.success(mode === 'edit' ? previous.pending_activation ? 'Changes saved — awaiting approval' : 'Changes saved' : 'Registration rejected');
      setMode(null);
    } catch (error) { toast.error(error instanceof Error ? error.message : (error as { message?: string }).message ?? 'Review could not be saved'); }
    finally { setBusy(false); }
  }
  return <>
    <div className="ml-auto flex shrink-0 gap-1">
      <Button variant="ghost" size="icon" title={`Edit ${name}`} aria-label={`Edit ${name}`} disabled={busy} onClick={() => open('edit')}><Pencil className="size-4" /></Button>
      {!editOnly && <Button variant="ghost" size="icon" className="text-destructive" title={`Reject ${name}`} aria-label={`Reject ${name}`} disabled={busy} onClick={() => open('reject')}><XCircle className="size-4" /></Button>}
    </div>
    <Dialog open={mode !== null} onOpenChange={value => { if (!value && !busy) setMode(null); }}>
      <DialogContent className="max-h-[85dvh] overflow-y-auto">
        <DialogHeader><DialogTitle>{mode === 'edit' ? 'Edit registration' : 'Reject registration'}: {name}</DialogTitle></DialogHeader>
        {!loaded ? <p>Loading registration…</p> : <form onSubmit={save} className="space-y-4">
          {mode === 'reject' ? <div className="space-y-2"><Label htmlFor={`reason-${id}`}>Rejection reason</Label><Textarea id={`reason-${id}`} required value={reason} onChange={e => setReason(e.target.value)} /></div> : fields.map(key => {
            const options = key === 'class_id' ? classes.map(c => ({ value: c.id, label: c.name })) : key === 'section' ? ['nursery', 'primary', 'secondary'].map(s => ({ value: s, label: s })) : key === 'gender' ? ['male', 'female'].map(s => ({ value: s, label: s })) : null;
            return <div key={key} className="space-y-2"><Label htmlFor={`review-${id}-${key}`}>{labels[key]}</Label>{options ? <Select value={values[key] || 'none'} onValueChange={v => setValues(current => ({ ...current, [key]: v === 'none' ? '' : v }))}><SelectTrigger id={`review-${id}-${key}`}><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">Not specified</SelectItem>{options.map(option => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent></Select> : <Input id={`review-${id}-${key}`} type={key === 'dob' ? 'date' : 'text'} required={['name','admission_no','first_name','last_name'].includes(key)} value={values[key] ?? ''} onChange={e => setValues(current => ({ ...current, [key]: e.target.value }))} />}</div>;
          })}
          <Button type="submit" variant={mode === 'reject' ? 'destructive' : 'default'} disabled={busy || (mode === 'reject' && !reason.trim())}>{busy ? 'Saving…' : mode === 'reject' ? 'Reject registration' : 'Save changes'}</Button>
        </form>}
      </DialogContent>
    </Dialog>
  </>;
}