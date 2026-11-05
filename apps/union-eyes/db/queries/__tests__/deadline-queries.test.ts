/**
 * Deadline dashboard query — unit tests.
 *
 * withRLSContext is mocked to run the callback with a fake tx whose execute() returns the rows the test queues.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ execute: vi.fn() }));

vi.mock('@/lib/db/with-rls-context', () => ({
  withRLSContext: async (op: (tx: unknown) => Promise<unknown>) => op({ execute: mocks.execute }),
}));

import { getDeadlineDashboardSummary } from '../deadline-queries';

const row = (overrides: Record<string, string | null> = {}) => ({
  active_deadlines: '12',
  overdue_count: '3',
  due_soon_count: '4',
  critical_count: '2',
  avg_days_overdue: '5.5',
  on_time_completed: '9',
  total_completed: '12',
  ...overrides,
});

describe('getDeadlineDashboardSummary', () => {
  beforeEach(() => {
    mocks.execute.mockReset();
  });

  it('maps the aggregate row to the dashboard counts', async () => {
    mocks.execute.mockResolvedValueOnce([row()]);
    expect(await getDeadlineDashboardSummary('org-1')).toEqual({
      activeDeadlines: 12,
      overdueCount: 3,
      dueSoonCount: 4,
      criticalCount: 2,
      avgDaysOverdue: 5.5,
      onTimePercentage: 75,
    });
  });

  it('reports 100 percent on time, and zero averages, for an organization with nothing completed or overdue', async () => {
    mocks.execute.mockResolvedValueOnce([row({ active_deadlines: '0', overdue_count: '0', due_soon_count: '0', critical_count: '0', avg_days_overdue: null, on_time_completed: '0', total_completed: '0' })]);
    expect(await getDeadlineDashboardSummary('org-1')).toEqual({
      activeDeadlines: 0,
      overdueCount: 0,
      dueSoonCount: 0,
      criticalCount: 0,
      avgDaysOverdue: 0,
      onTimePercentage: 100,
    });
  });

  it('rounds the on-time percentage to a whole number', async () => {
    mocks.execute.mockResolvedValueOnce([row({ on_time_completed: '2', total_completed: '3' })]);
    expect((await getDeadlineDashboardSummary('org-1')).onTimePercentage).toBe(67);
  });

  it('lets a failing query fail, instead of answering with zeros', async () => {
    mocks.execute.mockRejectedValueOnce(new Error('relation "claim_deadlines" does not exist'));
    await expect(getDeadlineDashboardSummary('org-1')).rejects.toThrow('claim_deadlines');
  });
});
