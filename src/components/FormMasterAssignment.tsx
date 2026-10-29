import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';

export function FormMasterAssignment({ schoolId, classId, teacherId, className }: { schoolId: string; classId: string; teacherId: string | null; className: string }) {
  const qc = useQueryClient();
  const [saving, setSaving] = useState(false);
  const staff = useQuery({
    queryKey: ['form-master-staff', schoolId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('form_master_candidates', { _school_id: schoolId });
      if (error) throw error;
      return data;
    },
  });
  async function assign(value: string) {
    setSaving(true);
    try {
      const target = value === '__none' ? null : value;
      const { data, error } = await supabase.rpc('assign_form_master', { _school_id: schoolId, _class_id: classId, _teacher_id: target ?? undefined });
      if (error) throw error;
      const saved = data as { id?: string; teacher_id?: string | null; school_id?: string } | null;
      if (saved?.id !== classId || saved.school_id !== schoolId || saved.teacher_id !== target) throw new Error('Class assignment could not be confirmed');
      await Promise.all(['classes', 'res-classes', 'score-entry-allocations', 'ac-alloc', 'form-master-classes'].map(key => qc.invalidateQueries({ queryKey: [key] })));
      toast.success(target ? 'Form master assigned' : 'Form master removed');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : (error as { message?: string }).message ?? 'Assignment failed');
    } finally { setSaving(false); }
  }
  if (staff.error) return <span role="alert" className="text-destructive">Staff could not be loaded</span>;
  return <Select value={teacherId ?? '__none'} onValueChange={assign} disabled={saving || staff.isPending}>
    <SelectTrigger aria-label={`Form master for ${className}`} className="min-w-44"><SelectValue placeholder={saving ? 'Saving…' : 'Choose form master'} /></SelectTrigger>
    <SelectContent>
      <SelectItem value="__none">Not assigned</SelectItem>
      {staff.data?.map(person => <SelectItem key={person.user_id} value={person.user_id}>{person.full_name || 'Staff member'}</SelectItem>)}
    </SelectContent>
  </Select>;
}