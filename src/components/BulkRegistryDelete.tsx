import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { ListChecks } from 'lucide-react';
import { toast } from 'sonner';

type Table = 'schools' | 'classes' | 'subjects' | 'students';

export function BulkRegistryDelete({ table, items, label }: { table: Table; items: { id: string; name: string }[]; label: string }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  const allOn = items.length > 0 && picked.size === items.length;

  const toggle = (id: string) => setPicked((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const run = async () => {
    if (typed.trim().toUpperCase() !== 'DELETE' || !picked.size) return;
    setBusy(true);
    let ok = 0; const failed: string[] = [];
    for (const id of picked) {
      const { data, error } = await supabase.rpc('manage_registry_item', { _table: table, _id: id, _action: 'purge' });
      if (error || !data) failed.push(items.find((i) => i.id === id)?.name ?? id); else ok++;
    }
    await qc.invalidateQueries();
    window.dispatchEvent(new Event('school-selection'));
    setBusy(false);
    if (ok) toast.success(`${ok} ${label} permanently deleted`);
    if (failed.length) toast.error(`Could not delete: ${failed.slice(0, 5).join(', ')}${failed.length > 5 ? '…' : ''}`);
    setPicked(new Set()); setTyped(''); setOpen(false);
  };

  return (
    <>
      <Button size="sm" variant="outline" className="text-destructive" disabled={!items.length} onClick={() => setOpen(true)}>
        <ListChecks className="mr-1 h-4 w-4" /> Delete several
      </Button>
      <Dialog open={open} onOpenChange={(o) => !busy && setOpen(o)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Delete {label}</DialogTitle>
            <DialogDescription>Tick the {label} to delete, or choose Select all. Their linked records (scores, attendance, fees) are erased too. This cannot be undone.</DialogDescription>
          </DialogHeader>
          <label className="flex items-center gap-2 border-b pb-2 text-sm font-medium">
            <Checkbox checked={allOn} onCheckedChange={(v) => setPicked(v ? new Set(items.map((i) => i.id)) : new Set())} />
            Select all ({items.length})
          </label>
          <div className="max-h-64 space-y-1 overflow-y-auto">
            {items.map((i) => (
              <label key={i.id} className="flex items-center gap-2 text-sm">
                <Checkbox checked={picked.has(i.id)} onCheckedChange={() => toggle(i.id)} /> {i.name}
              </label>
            ))}
          </div>
          <label className="grid gap-1 text-sm">
            Type DELETE to confirm ({picked.size} selected)
            <input className="h-9 rounded-md border border-input bg-background px-3" value={typed} onChange={(e) => setTyped(e.target.value)} />
          </label>
          <div className="flex justify-end gap-2">
            <Button variant="outline" disabled={busy} onClick={() => setOpen(false)}>Cancel</Button>
            <Button variant="destructive" disabled={busy || !picked.size || typed.trim().toUpperCase() !== 'DELETE'} onClick={run}>
              {busy ? 'Deleting…' : `Delete ${picked.size}`}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
