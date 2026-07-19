/**
 * Analytics Queries — Unit Tests
 *
 * Raw-SQL module: every query runs through
 * `withRLSContext(async (tx) => tx.execute(sql\`...\`))`.
 * The mock invokes the callback with a fake tx whose `execute` shifts the next
 * result off a controllable queue (default []), so each call site is driven
 * deterministically. drizzle-orm `sql` and `safe-sql-identifiers` stay REAL
 * (tx.execute ignores the built query object).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({ queue: [] as unknown[] }));

vi.mock('@/lib/db/with-rls-context', () => ({
  withRLSContext: async (op: (tx: unknown) => Promise<unknown>) =>
    op({
      execute: async () => (mocks.queue.length ? mocks.queue.shift() : []),
    }),
}));

import * as q from '../analytics-queries';

function push(...rows: unknown[]) {
  mocks.queue.push(...rows);
}

const range = { startDate: new Date('2025-01-01'), endDate: new Date('2025-02-01') };

beforeEach(() => {
  mocks.queue = [];
  vi.clearAllMocks();
});

describe('analytics-queries — executive & trends', () => {
  it('getExecutiveSummary aggregates current/deadline/prev metrics', async () => {
    push(
      [{ total_claims: 10, open_claims: 4, resolved_claims: 6, win_rate: 50, avg_resolution_days: 5 }],
      [{ on_time_rate: 90 }],
      [{ total_claims: 8, avg_resolution_days: 6, win_rate: 40 }],
    );
    const r = await q.getExecutiveSummary('org', range);
    expect(r.totalClaims).toBe(10);
    expect(r.onTimeDeadlineRate).toBe(90);
    expect(r.periodComparison.claimsGrowth).toBe(25);
  });

  it('getExecutiveSummary tolerates empty period metrics (zero growth)', async () => {
    push([{}], [], [{}]);
    const r = await q.getExecutiveSummary('org', range);
    expect(r.totalClaims).toBe(0);
    expect(r.periodComparison.winRateChange).toBe(0);
  });

  it('getMonthlyTrends maps rows', async () => {
    push([{ period: '2025-01', value: '12', change_percentage: '3' }]);
    const r = await q.getMonthlyTrends('org', 6);
    expect(r[0]).toMatchObject({ period: '2025-01', value: 12, changePercentage: 3 });
  });

  it('getMonthlyTrends uses default monthsBack', async () => {
    push([]);
    expect(await q.getMonthlyTrends('org')).toEqual([]);
  });
});

describe('analytics-queries — claims', () => {
  it('getClaimsAnalytics assembles all breakdowns', async () => {
    push(
      [{ total_claims: 5, avg_resolution_days: 4, median_resolution_days: 3 }],
      [{ status: 'open', count: 2 }],
      [{ claim_type: 'grievance', count: 3 }],
      [{ priority: 'high', count: 1 }],
      [{ date: '2025-01-01', count: 2, avg_days: 4 }],
      [{ id: 's1', name: 'Jo', caseload: 5, performance_score: 90 }],
    );
    const r = await q.getClaimsAnalytics('org', range);
    expect(r.totalClaims).toBe(5);
    expect(r.claimsByStatus).toEqual({ open: 2 });
    expect(r.topStewards[0].id).toBe('s1');
  });

  it('getClaimsByDateRange with all filters', async () => {
    push([{ id: 'c1' }]);
    const r = await q.getClaimsByDateRange('org', range, {
      status: ['open'],
      claimType: ['grievance'],
      priority: ['high'],
      assignedTo: 'u1',
    });
    expect(r).toHaveLength(1);
  });

  it('getClaimsByDateRange without filters', async () => {
    push([]);
    expect(await q.getClaimsByDateRange('org', range)).toEqual([]);
  });
});

describe('analytics-queries — member / deadline / financial', () => {
  it('getMemberAnalytics assembles counts, engagement, cohorts', async () => {
    push(
      [{ total_members: 100, active_members: 80, new_members_30_days: 5 }],
      [{ avg_retention_rate: 70 }],
      [{ engagement_level: 'high', count: 30 }],
      [{ avg_claims: 2 }],
      [{ id: 'm1', name: 'Al', claims_count: 4, win_rate: 60 }],
      [{ cohort_month: '2025-01', size: 10, retention_rate: 80 }],
    );
    const r = await q.getMemberAnalytics('org', range);
    expect(r.totalMembers).toBe(100);
    expect(r.engagementDistribution).toEqual({ high: 30 });
    expect(r.cohortAnalysis[0].size).toBe(10);
  });

  it('getDeadlineAnalytics assembles metrics and trend', async () => {
    push(
      [{ total_deadlines: 20, overdue_count: 3, on_time_rate: 85, avg_days_overdue: 2, critical_overdue_count: 1 }],
      [{ approval_rate: 75 }],
      [{ date: '2025-01-01', on_time_rate: 85, overdue_count: 3 }],
      [{ priority: 'high', count: 4 }],
    );
    const r = await q.getDeadlineAnalytics('org', range);
    expect(r.totalDeadlines).toBe(20);
    expect(r.extensionApprovalRate).toBe(75);
    expect(r.deadlinesByPriority).toEqual({ high: 4 });
  });

  it('getFinancialAnalytics assembles metrics, trend, outcomes', async () => {
    push(
      [{ total_claim_value: 1000, total_settlements: 500, total_legal_costs: 100, avg_claim_value: 100, avg_settlement: 50, cost_per_claim: 10, recovery_rate: 50 }],
      [{ date: '2025-01-01', claim_value: 1000, settlements: 500, costs: 100 }],
      [{ outcome: 'won', count: 3, value: 600 }],
    );
    const r = await q.getFinancialAnalytics('org', range);
    expect(r.totalClaimValue).toBe(1000);
    expect(r.outcomeDistribution).toEqual({ won: { count: 3, value: 600 } });
  });

  it('getWeeklyActivityHeatmap maps rows', async () => {
    push([{ day_of_week: 1, hour_of_day: 9, activity_score: 5, claim_count: 2 }]);
    const r = await q.getWeeklyActivityHeatmap('org');
    expect(r[0]).toEqual({ dayOfWeek: 1, hourOfDay: 9, activityScore: 5, claimCount: 2 });
  });
});

describe('analytics-queries — legacy reports & export jobs', () => {
  it('getReportsLegacy with userId branch', async () => {
    push([{ id: 'r1' }]);
    expect(await q.getReportsLegacy('org', 'u1')).toHaveLength(1);
  });
  it('getReportsLegacy without userId', async () => {
    push([]);
    expect(await q.getReportsLegacy('org')).toEqual([]);
  });

  it('createReportLegacy returns inserted row', async () => {
    push([{ id: 'r1' }]);
    const r = await q.createReportLegacy('org', 'u1', {
      name: 'R',
      reportType: 'claims',
      config: {},
      description: 'd',
      category: 'c',
      isPublic: true,
      isTemplate: true,
      templateId: 't1',
    });
    expect(r).toEqual({ id: 'r1' });
  });
  it('createReportLegacy with minimal data (null defaults)', async () => {
    push([{ id: 'r2' }]);
    expect(await q.createReportLegacy('org', 'u1', { name: 'R', reportType: 'claims', config: {} })).toEqual({
      id: 'r2',
    });
  });

  it('updateReportRunStats resolves', async () => {
    push([]);
    await expect(q.updateReportRunStats('r1')).resolves.toBeUndefined();
  });

  it('createExportJob returns inserted row', async () => {
    push([{ id: 'j1' }]);
    expect(
      await q.createExportJob('org', 'u1', { reportId: 'r1', scheduleId: 's1', exportType: 'pdf' }),
    ).toEqual({ id: 'j1' });
  });
  it('createExportJob with minimal data', async () => {
    push([{ id: 'j2' }]);
    expect(await q.createExportJob('org', 'u1', { exportType: 'csv' })).toEqual({ id: 'j2' });
  });

  it('updateExportJobStatus covers processing/completed/failed/unknown', async () => {
    push([]);
    await expect(q.updateExportJobStatus('j1', 'processing')).resolves.toBeUndefined();
    push([]);
    await expect(q.updateExportJobStatus('j1', 'completed', 'http://f')).resolves.toBeUndefined();
    push([]);
    await expect(q.updateExportJobStatus('j1', 'failed', undefined, 'boom')).resolves.toBeUndefined();
    // unknown status: no execute call, still resolves
    await expect(q.updateExportJobStatus('j1', 'queued')).resolves.toBeUndefined();
  });

  it('getExportJob returns first row', async () => {
    push([{ id: 'j1' }]);
    expect(await q.getExportJob('j1')).toEqual({ id: 'j1' });
  });

  it('getUserExportJobs returns rows', async () => {
    push([{ id: 'j1' }]);
    expect(await q.getUserExportJobs('org', 'u1')).toHaveLength(1);
  });

  it('refreshAnalyticsViews and getViewRefreshStats resolve', async () => {
    push([{ ok: true }]);
    expect(await q.refreshAnalyticsViews()).toEqual([{ ok: true }]);
    push([{ matviewname: 'mv_x' }]);
    expect(await q.getViewRefreshStats()).toHaveLength(1);
  });
});

describe('analytics-queries — reports (phase 2)', () => {
  it('getReports with all filters', async () => {
    push([{ id: 'r1' }]);
    const r = await q.getReports('org', 'u1', {
      category: 'ops',
      isTemplate: true,
      isPublic: false,
      search: 'x',
    });
    expect(r).toHaveLength(1);
  });
  it('getReports without filters', async () => {
    push([]);
    expect(await q.getReports('org', 'u1')).toEqual([]);
  });

  it('getReportById returns row or null', async () => {
    push([{ id: 'r1' }]);
    expect(await q.getReportById('r1', 'org')).toEqual({ id: 'r1' });
    push([]);
    expect(await q.getReportById('missing', 'org')).toBeNull();
  });

  it('createReport returns inserted row', async () => {
    push([{ id: 'r1' }]);
    expect(
      await q.createReport('org', 'u1', { name: 'R', reportType: 'claims', config: {} }),
    ).toEqual({ id: 'r1' });
  });

  it('updateReport with all fields', async () => {
    push([{ id: 'r1' }]);
    const r = await q.updateReport('r1', 'org', 'u1', {
      name: 'N',
      description: 'D',
      config: {},
      isPublic: true,
    });
    expect(r).toEqual({ id: 'r1' });
  });
  it('updateReport with no optional fields (only audit columns)', async () => {
    push([{ id: 'r1' }]);
    expect(await q.updateReport('r1', 'org', 'u1', {})).toEqual({ id: 'r1' });
  });

  it('deleteReport returns true', async () => {
    push([]);
    expect(await q.deleteReport('r1', 'org')).toBe(true);
  });

  it('logReportExecution inserts and bumps report stats', async () => {
    push([{ id: 'ex1' }], []);
    const r = await q.logReportExecution('r1', 'org', 'u1', {
      format: 'pdf',
      parameters: { a: 1 },
      resultCount: 10,
      executionTimeMs: 100,
      fileUrl: 'http://f',
      fileSize: 2048,
      status: 'completed',
      errorMessage: 'none',
    });
    expect(r).toEqual({ id: 'ex1' });
  });
  it('logReportExecution with minimal data', async () => {
    push([{ id: 'ex2' }], []);
    expect(
      await q.logReportExecution('r1', 'org', 'u1', {
        format: 'csv',
        executionTimeMs: 50,
        status: 'completed',
      }),
    ).toEqual({ id: 'ex2' });
  });

  it('getReportExecutions returns rows', async () => {
    push([{ id: 'ex1' }]);
    expect(await q.getReportExecutions('r1', 'org', 10)).toHaveLength(1);
  });
  it('getReportExecutions uses default limit', async () => {
    push([]);
    expect(await q.getReportExecutions('r1', 'org')).toEqual([]);
  });

  it('getReportTemplates with org + category', async () => {
    push([{ id: 'rt1' }]);
    expect(await q.getReportTemplates('org', 'ops')).toHaveLength(1);
  });
  it('getReportTemplates system-only (no org)', async () => {
    push([{ id: 'rt2' }]);
    expect(await q.getReportTemplates()).toHaveLength(1);
  });

  it('createReportFromTemplate clones template into a report', async () => {
    push([{ description: 'd', category: 'c', config: {} }], [{ id: 'r1' }]);
    expect(await q.createReportFromTemplate('t1', 'org', 'u1', 'New')).toEqual({ id: 'r1' });
  });
  it('createReportFromTemplate throws when template missing', async () => {
    push([]);
    await expect(q.createReportFromTemplate('missing', 'org', 'u1', 'New')).rejects.toThrow(
      'Template not found',
    );
  });
});
