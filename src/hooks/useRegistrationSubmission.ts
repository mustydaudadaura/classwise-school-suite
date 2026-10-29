import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export function useRegistrationSubmission(userId: string | undefined, schoolId: string | null) {
  const query = useQuery({
    queryKey: ['registration-submission', userId, schoolId],
    enabled: Boolean(userId && schoolId),
    queryFn: async () => {
      if (!userId || !schoolId) return false;
      const { data, error } = await supabase.rpc('can_submit_school_registration', { _user_id: userId, _school_id: schoolId });
      if (error) throw error;
      return data === true;
    },
  });
  return { allowed: query.data === true, loading: query.isPending, error: query.error };
}