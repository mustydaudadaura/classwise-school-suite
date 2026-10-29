import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';

export function PendingClassActivations({ classes, kind = 'classes' }: { classes: { id: string; name: string }[]; kind?: 'classes' | 'subjects' }) {
  const [selected, setSelected] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const qc = useQueryClient();
  if (!classes.length) return null;
  const ids = selected.filter(id => classes.some(c => c.id === id));
  const activate = async () => {
    if (!ids.length || busy) return;
    setBusy(true);
    try {
      const { data, error } = await supabase.rpc(kind === 'classes' ? 'activate_pending_classes' : 'activate_pending_subjects', { _ids: ids });
      if (error) throw error;
      if (!data) throw new Error(`No ${kind} were activated. Check your school administrator access and approve any linked class first.`);
      setSelected([]);
      await qc.invalidateQueries();
      toast.success(`${data} ${kind} approved and activated`);
    } catch (error) { toast.error(error instanceof Error ? error.message : (error as { message?: string }).message ?? 'Class approval failed'); }
    finally { setBusy(false); }
  };
  return <section className="space-y-3 border-b border-border py-4">
    <h2 className="text-lg font-semibold">{kind === 'classes' ? 'Classes' : 'Subjects'} awaiting approval ({classes.length})</h2>
    <div className="flex flex-wrap items-center gap-3">
      <label className="flex items-center gap-2 text-sm"><Checkbox aria-label={`Select all pending ${kind}`} checked={ids.length === classes.length} onCheckedChange={checked => setSelected(checked ? classes.map(c => c.id) : [])} />Select all</label>
      <Button size="sm" onClick={activate} disabled={busy || !ids.length}>{busy ? 'Activating…' : `Approve & activate selected (${ids.length})`}</Button>
    </div>
    <ul className="divide-y divide-border">{classes.map(c => <li key={c.id} className="flex items-center gap-3 py-2"><Checkbox aria-label={`Select ${kind === 'classes' ? 'class' : 'subject'} ${c.name}`} checked={ids.includes(c.id)} onCheckedChange={checked => setSelected(current => checked ? Array.from(new Set([...current, c.id])) : current.filter(id => id !== c.id))} /><span>{c.name}</span></li>)}</ul>
  </section>;
}