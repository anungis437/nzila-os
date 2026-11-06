import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
  options: null as Record<string, unknown> | null,
  audit: vi.fn(),
  scopes: [] as unknown[],
  configRows: [] as Array<Record<string, unknown>>,
  metricRows: [] as Array<Record<string, unknown>>,
}));

vi.mock('@/lib/api/framework', () => ({
  withApi: (options: Record<string, unknown>, handler: unknown) => {
    m.options = options;
    return handler;
  },
  ApiError: {
    forbidden: (message: string) => Object.assign(new Error(message), { code: 'FORBIDDEN' }),
  },
}));
vi.mock('drizzle-orm', () => ({
  eq: vi.fn(() => ({})),
  and: vi.fn(() => ({})),
  desc: vi.fn(() => ({})),
  gte: vi.fn(() => ({})),
}));
vi.mock('@/db/schema', () => ({
  kpiConfigurations: { kind: 'configs', organizationId: 'org', displayOrder: 'order' },
  analyticsMetrics: { kind: 'metrics', organizationId: 'org', metricType: 'type', periodEnd: 'period' },
}));
vi.mock('@/lib/audit/atomic-audit', () => ({
  persistAtomicAudit: (...args: unknown[]) => m.audit(...args),
}));
vi.mock('@/lib/db/with-rls-context', () => ({
  withRLSContext: (scope: unknown, callback: (tx: unknown) => Promise<unknown>) => {
    m.scopes.push(scope);
    const tx = {
      select: () => ({
        from: (table: { kind: string }) => ({
          where: () => ({
            orderBy: () => table.kind === 'configs'
              ? Promise.resolve(m.configRows)
              : { limit: () => Promise.resolve(m.metricRows) },
          }),
        }),
      }),
    };
    return callback(tx);
  },
}));

const org = '11111111-1111-4111-8111-111111111111';
const officer = 'officer-1';

describe('KPI target summary — disclosure and read audit', () => {
  beforeEach(() => {
    m.audit.mockReset().mockResolvedValue(undefined);
    m.scopes.length = 0;
    m.configRows = [{
      id: 'target-1', organizationId: org, name: 'Case response time',
      description: 'Average response time', metricType: 'resolution_time',
      dataSource: 'claims', visualizationType: 'gauge', targetValue: '5',
      warningThreshold: '8', criticalThreshold: '12', isActive: true,
      displayOrder: 1, createdBy: 'private-officer-id',
      alertRecipients: ['private@example.invalid'], calculation: { formula: 'secret' },
      dashboardLayout: { private: true }, refreshInterval: 3600,
    }];
    m.metricRows = [{ metricValue: '4', trend: 'stable' }];
  });

  it('requires officer authority rather than granting every member KPI configurations', async () => {
    const { GET } = await import('../targets/summary/route');
    expect(m.options).toMatchObject({ auth: { minRole: 'officer' }, requireOrg: true });
    await expect((GET as unknown as (ctx: unknown) => Promise<unknown>)({ organizationId: null, userId: officer }))
      .rejects.toMatchObject({ code: 'FORBIDDEN' });
    expect(m.scopes).toHaveLength(0);
  });

  it('returns an explicit projection and writes a scoped audit without exposing sensitive fields', async () => {
    const { GET } = await import('../targets/summary/route');
    const result = await (GET as unknown as (ctx: unknown) => Promise<unknown>)({ organizationId: org, userId: officer });
    expect(m.scopes).toEqual([{ organizationId: org, userId: officer }]);
    expect(result.summary.total).toBe(1);
    expect(result.targets[0]).toMatchObject({ id: 'target-1', name: 'Case response time' });
    for (const key of ['calculation', 'alertRecipients', 'createdBy', 'dashboardLayout', 'refreshInterval', 'organizationId']) {
      expect(result.targets[0], key).not.toHaveProperty(key);
    }
    expect(m.audit).toHaveBeenCalledOnce();
    expect(m.audit.mock.calls[0][1]).toMatchObject({
      organizationId: org, userId: officer, action: 'target.summary.read',
      resourceType: 'kpi_configurations', details: { targetCount: 1 },
    });
  });

  it('does not present a metric row as the value when the declared calculation cannot be applied (DEF-0B12-PLT-KPI-CURRENT-VALUE-IS-THE-LATEST-ROW-OF-THE-METRIC-TYPE-TEXT-NOT-THE-DECLARED-SOURCE-OR-CALCULATION)', async () => {
    // The configured calculation is not a supported aggregation; the stored row of the same metric type is not the value.
    const { GET } = await import('../targets/summary/route');
    const result = await (GET as unknown as (ctx: unknown) => Promise<{ targets: Array<Record<string, unknown>> }>)({ organizationId: org, userId: officer });
    expect(result.targets[0]).toMatchObject({ currentValue: null, valueBasis: 'not_measured', health: 'no_data', progress: null });
    expect(String(result.targets[0].notMeasuredReason)).toMatch(/no supported aggregation/);
  });

  it('applies the declared aggregation to the recent periods of the declared source', async () => {
    m.configRows = [{ ...m.configRows[0], calculation: { aggregation: 'avg' } }];
    m.metricRows = [
      { metricValue: '4', periodType: 'monthly', periodStart: new Date(Date.now() - 40 * 86_400_000), periodEnd: new Date(Date.now() - 10 * 86_400_000), trend: 'up' },
      { metricValue: '6', periodType: 'monthly', periodStart: new Date(Date.now() - 70 * 86_400_000), periodEnd: new Date(Date.now() - 40 * 86_400_000), trend: 'down' },
    ];
    const { GET } = await import('../targets/summary/route');
    const result = await (GET as unknown as (ctx: unknown) => Promise<{ targets: Array<Record<string, unknown>> }>)({ organizationId: org, userId: officer });
    expect(result.targets[0]).toMatchObject({ currentValue: 5, valueBasis: 'declared_aggregation_of_metric_periods', periodsUsed: 2, aggregation: 'avg', stale: false });
  });

  it('does not return a successful summary if its audit write fails', async () => {
    m.audit.mockRejectedValueOnce(new Error('audit unavailable'));
    const { GET } = await import('../targets/summary/route');
    await expect((GET as unknown as (ctx: unknown) => Promise<unknown>)({ organizationId: org, userId: officer }))
      .rejects.toThrow('audit unavailable');
  });
});
