import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth, hasRole } from '@/hooks/useAuth';
import { SCHOOL_PERMISSIONS, type SchoolPermission } from '@/lib/school-access';

const TEACHER_DEFAULT_PERMISSIONS: SchoolPermission[] = [
  'students.view',
  'academics.view',
  'academics.edit',
  'results.view',
  'results.edit',
  'attendance.view',
  'attendance.edit',
  'staffatt.view',
  'staffatt.edit',
];

const ACCOUNTANT_DEFAULT_PERMISSIONS: SchoolPermission[] = [
  'fees.view',
  'fees.edit',
  'staffatt.view',
  'staffatt.edit',
  'payroll.view',
  'payroll.edit',
];

export function useSchoolAccess() {
  const { user, schoolId, roles } = useAuth();
  const isAdmin = hasRole(roles, 'super_admin', 'school_admin');
  const isTeacher = hasRole(roles, 'teacher');
  const isFormMaster = roles.some((role: string) => role === 'form_master');
  const isAccountant = hasRole(roles, 'accountant');

  const query = useQuery({
    queryKey: ['school-access', user?.id, schoolId, isAdmin, isTeacher, isFormMaster, isAccountant],
    enabled: Boolean(user && schoolId),
    queryFn: async () => {
      if (!user || !schoolId) return [];
      if (isAdmin) return [...SCHOOL_PERMISSIONS];

      const baseline = new Set<SchoolPermission>();
      if (isTeacher || isFormMaster) {
        TEACHER_DEFAULT_PERMISSIONS.forEach((p) => baseline.add(p));
      }
      if (isAccountant) {
        ACCOUNTANT_DEFAULT_PERMISSIONS.forEach((p) => baseline.add(p));
      }

      try {
        const rows = await Promise.all(
          SCHOOL_PERMISSIONS.map(async (permission) => {
            try {
              const { data, error } = await supabase.rpc('school_permission', {
                _user_id: user.id,
                _school_id: schoolId,
                _permission: permission,
              });
              if (error) return baseline.has(permission) ? permission : null;
              return data ? permission : (baseline.has(permission) ? permission : null);
            } catch {
              return baseline.has(permission) ? permission : null;
            }
          })
        );
        return rows.filter((p): p is SchoolPermission => p !== null);
      } catch {
        return Array.from(baseline);
      }
    },
  });

  const canCheck = (permission: SchoolPermission) => {
    if (isAdmin) return true;
    if ((isTeacher || isFormMaster) && TEACHER_DEFAULT_PERMISSIONS.includes(permission)) return true;
    if (isAccountant && ACCOUNTANT_DEFAULT_PERMISSIONS.includes(permission)) return true;
    return query.data?.includes(permission) ?? false;
  };

  return {
    schoolId,
    loading: query.isPending && Boolean(schoolId) && !isAdmin,
    error: query.error,
    can: canCheck,
  };
}