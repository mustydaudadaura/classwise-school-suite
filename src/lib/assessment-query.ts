import { queryOptions } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { QueryClient } from '@tanstack/react-query';

export async function refreshScoreViews(client: QueryClient) {
  // PIN-protected report details are intentionally excluded: refetching consumes a paid view.
  await Promise.all(['assessments', 'class-monitor-assessments', 'ranking-preview', 'report-card', 'report-cards-list', 'islamiyya-report', 'yearly', 'student-360', 'analytics-assessments', 'dashboard-metrics', 'dashboard-stats', 'super-admin-dashboard-metrics', 'my-results', 'portal-rc', 'portal-summary'].map(key => client.invalidateQueries({ queryKey: [key] })));
}

export function classAssessmentOptions(schoolId: string, classId: string, session: string, term: 'first' | 'second' | 'third') {
  return queryOptions({
    queryKey: ['assessments', schoolId, classId, session, term],
    enabled: Boolean(schoolId && classId),
    staleTime: 0,
    queryFn: async () => {
      const rows = [];
      for (let from = 0; ; from += 1000) {
        const { data, error } = await supabase.from('assessments').select('*')
          .eq('school_id', schoolId).eq('class_id', classId).eq('session', session).eq('term', term)
          .order('id').range(from, from + 999);
        if (error) throw error;
        rows.push(...(data ?? []));
        if (!data || data.length < 1000) return rows;
      }
    },
  });
}