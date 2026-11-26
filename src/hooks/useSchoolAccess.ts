import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { SCHOOL_PERMISSIONS, type SchoolPermission } from '@/lib/school-access';
import { customRoleGrants } from '@/lib/standard-roles';

export function useSchoolAccess() {
  const { user, schoolId, roles } = useAuth();
  const query = useQuery({
    queryKey: ['school-access', user?.id, schoolId, roles],
    enabled: Boolean(user && schoolId),
    queryFn: async () => {
      if (!user || !schoolId) return [];
      try {
        const rows = await Promise.all(
          SCHOOL_PERMISSIONS.map(async (permission) => {
            try {
              const { data, error } = await supabase.rpc('school_permission', {
                _user_id: user.id,
                _school_id: schoolId,
                _permission: permission,
              });
              if (error) throw error;
              return data ? permission : null;
            } catch {
              return null;
            }
          })
        );
        return rows.filter((p): p is SchoolPermission => p !== null);
      } catch {
        return [];
      }
    },
  });

  const grants = useQuery({
    queryKey: ['school-access-grants', user?.id, schoolId],
    enabled: Boolean(user && schoolId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('school_role_assignments')
        .select('active, school_custom_roles(active, permissions)')
        .eq('user_id', user!.id)
        .eq('school_id', schoolId!);
      if (error) return [] as SchoolPermission[];
      return customRoleGrants((data ?? []) as never);
    },
  });

  const canCheck = (permission: SchoolPermission) => {
    return query.data?.includes(permission) ?? false;
  };

  return {
    schoolId,
    loading: query.isPending && Boolean(schoolId),
    error: query.error,
    can: canCheck,
    granted: grants.data ?? [],
  };
}