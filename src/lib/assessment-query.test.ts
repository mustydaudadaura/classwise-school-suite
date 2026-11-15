import { describe, expect, it, vi } from 'vitest';
import { QueryClient } from '@tanstack/react-query';
vi.mock('@/integrations/supabase/client', () => ({ supabase: {} }));
import { refreshScoreViews } from './assessment-query';

describe('score refresh', () => {
  it('refreshes entry, review, ranking, reports, family lists and analytics together', async () => {
    const client = new QueryClient();
    const refresh = vi.spyOn(client, 'invalidateQueries').mockResolvedValue();
    await refreshScoreViews(client);
    for (const key of ['assessments', 'class-monitor-assessments', 'ranking-preview', 'report-card', 'report-cards-list', 'islamiyya-report', 'yearly', 'student-360', 'analytics-assessments', 'dashboard-metrics', 'my-results', 'portal-rc']) {
      expect(refresh).toHaveBeenCalledWith({ queryKey: [key] });
    }
  });
  it('does not reopen scratch-card reports or consume paid views', async () => {
    const client = new QueryClient();
    const refresh = vi.spyOn(client, 'invalidateQueries').mockResolvedValue();
    await refreshScoreViews(client);
    expect(refresh).not.toHaveBeenCalledWith({ queryKey: ['portal-rc-detail'] });
    expect(refresh.mock.calls.length).toBe(16);
  });
});