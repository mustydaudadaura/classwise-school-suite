import { queryOptions } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export function classAssessmentOptions(schoolId: string, classId: string, session: string, term: 'first' | 'second' | 'third') {
  return queryOptions({
    queryKey: ['assessments', schoolId, classId, session, term],
    enabled: Boolean(schoolId && classId),
    staleTime: 0,
    queryFn: async () => {
      const { data, error } = await supabase.from('assessments').select('*')
        .eq('school_id', schoolId).eq('class_id', classId).eq('session', session).eq('term', term);
      if (error) throw error;
      return data ?? [];
    },
  });
}