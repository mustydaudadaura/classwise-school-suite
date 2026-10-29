import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth, hasRole } from '@/hooks/useAuth';
import { RegistryActions } from '@/components/RegistryActions';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';

export function StaffAccessRegistry() {
  const { user, roles, schoolId } = useAuth();
  const isSuper = hasRole(roles, 'super_admin');
  const query = useQuery({
    queryKey: ['staff-access-registry', schoolId, isSuper],
    enabled: Boolean(user && (isSuper || schoolId)),
    queryFn: async () => {
      let request = supabase.from('user_roles').select('id,user_id,role,school_id,active');
      if (!isSuper && schoolId) request = request.eq('school_id', schoolId);
      const { data: assignments, error } = await request;
      if (error) throw error;
      const ids = [...new Set((assignments ?? []).map(r => r.user_id))];
      const { data: profiles, error: profileError } = ids.length ? await supabase.from('profiles').select('user_id,full_name').in('user_id',ids) : { data: [], error: null };
      if (profileError) throw profileError;
      return (assignments ?? []).map(r => ({ ...r, name: profiles?.find(p => p.user_id === r.user_id)?.full_name ?? 'Staff account' }));
    },
  });
  if (!isSuper && !hasRole(roles, 'school_admin')) return null;
  return <section className="space-y-3 border-b border-border pb-6">
    <h2 className="text-lg font-semibold">Registered staff &amp; assigned roles</h2>
    {query.error ? <p role="alert" className="text-destructive">{query.error.message}</p> : <Table><TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Role</TableHead><TableHead>Actions</TableHead></TableRow></TableHeader><TableBody>
      {query.data?.map(r => <TableRow key={r.id}><TableCell>{r.name}</TableCell><TableCell>{r.role.replaceAll('_',' ')}</TableCell><TableCell>{r.user_id === user?.id || r.role === 'super_admin' ? <span className="text-xs text-muted-foreground">Protected access</span> : <RegistryActions table="user_roles" id={r.id} name={`${r.name} · ${r.role.replaceAll('_',' ')}`} active={r.active} />}</TableCell></TableRow>)}
      {!query.data?.length && <TableRow><TableCell colSpan={3}>{query.isPending ? 'Loading staff…' : 'No assigned staff roles'}</TableCell></TableRow>}
    </TableBody></Table>}
  </section>;
}