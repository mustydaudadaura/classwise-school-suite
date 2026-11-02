import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { PauseCircle, RotateCcw, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { RegistrationReview } from '@/components/RegistrationReview';

type RegistryTable = 'schools' | 'classes' | 'subjects' | 'students' | 'user_roles' | 'school_custom_roles' | 'school_role_assignments';

export function RegistryActions({
  table,
  id,
  name,
  active = true,
  onDeleted,
}: {
  table: RegistryTable;
  id: string;
  name: string;
  active?: boolean;
  onDeleted?: () => void;
}) {
  const qc = useQueryClient();
  const [action, setAction] = useState<'delete' | 'deactivate' | 'reactivate' | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const confirm = async () => {
    if (!action || busy) return;
    setBusy(true);
    setError('');
    try {
      // Data-integrity safeguard for student deletion: if the student has no academic, attendance, or fee history,
      // unlink non-historical guardian/enrollment join rows first so manage_registry_item can complete cleanly.
      if (table === 'students' && action === 'delete') {
        const [ass, rep, att, inv, pay] = await Promise.all([
          supabase.from('assessments').select('id', { count: 'exact', head: true }).eq('student_id', id),
          supabase.from('report_cards').select('id', { count: 'exact', head: true }).eq('student_id', id),
          supabase.from('attendance').select('id', { count: 'exact', head: true }).eq('student_id', id),
          supabase.from('fee_invoices').select('id', { count: 'exact', head: true }).eq('student_id', id),
          supabase.from('fee_payments').select('id', { count: 'exact', head: true }).eq('student_id', id),
        ]);
        const hasHistory =
          (ass.count ?? 0) > 0 ||
          (rep.count ?? 0) > 0 ||
          (att.count ?? 0) > 0 ||
          (inv.count ?? 0) > 0 ||
          (pay.count ?? 0) > 0;

        if (!hasHistory) {
          await supabase.from('student_parents').delete().eq('student_id', id);
          await supabase.from('student_enrollments').delete().eq('student_id', id);
          await supabase.from('admissions').update({ student_id: null }).eq('student_id', id);
        }
      }

      const { data, error: failure } = await supabase.rpc('manage_registry_item', {
        _table: table,
        _id: id,
        _action: action,
      });
      if (failure) throw new Error(failure.message);
      if (!data) throw new Error('The change was not saved.');
      await qc.invalidateQueries();
      window.dispatchEvent(new Event('school-selection'));
      toast.success(
        action === 'delete'
          ? 'Record permanently deleted'
          : action === 'deactivate'
          ? 'Record deactivated'
          : 'Record reactivated'
      );
      setAction(null);
      if (action === 'delete' && onDeleted) {
        onDeleted();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not update this item');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="inline-flex items-center gap-1">
      {(table === 'classes' || table === 'subjects' || table === 'students') && (
        <RegistrationReview kind={table} id={id} name={name} editOnly />
      )}
      <span className="text-xs text-muted-foreground">{active ? 'Active' : 'Inactive'}</span>
      <Button
        size="icon"
        variant="ghost"
        title={active ? 'Deactivate' : 'Reactivate'}
        aria-label={`${active ? 'Deactivate' : 'Reactivate'} ${name}`}
        onClick={() => {
          setError('');
          setAction(active ? 'deactivate' : 'reactivate');
        }}
      >
        {active ? <PauseCircle className="h-4 w-4" /> : <RotateCcw className="h-4 w-4" />}
      </Button>
      <Button
        size="icon"
        variant="ghost"
        className="text-destructive"
        title="Delete"
        aria-label={`Delete ${name}`}
        onClick={() => {
          setError('');
          setAction('delete');
        }}
      >
        <Trash2 className="h-4 w-4" />
      </Button>
      <Dialog
        open={action !== null}
        onOpenChange={(open) => {
          if (!open && !busy) setAction(null);
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {action === 'delete' ? 'Delete' : action === 'deactivate' ? 'Deactivate' : 'Reactivate'} {name}?
            </DialogTitle>
            <DialogDescription>
              {action === 'delete'
                ? 'Deletion is permanent. Records with academic, attendance, or financial history cannot be deleted; deactivate them instead to preserve school records.'
                : action === 'deactivate'
                ? 'The record will become inactive. Existing school records will be preserved.'
                : 'The record will become active again.'}
            </DialogDescription>
          </DialogHeader>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="outline" disabled={busy} onClick={() => setAction(null)}>
              Cancel
            </Button>
            <Button variant={action === 'delete' ? 'destructive' : 'default'} disabled={busy} onClick={confirm}>
              {busy ? 'Saving…' : 'Confirm'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}