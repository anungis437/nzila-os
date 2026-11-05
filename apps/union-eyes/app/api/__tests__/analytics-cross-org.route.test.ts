import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
  rows: [] as Array<Record<string, unknown>>,
  select: vi.fn(),
  withSystemContext: vi.fn((handler: (tx: unknown) => unknown) => handler({ select: (...args: unknown[]) => m.select(...args) })),
  audit: vi.fn(),
}));

vi.mock('@/lib/api/with-api', () => ({
  withApi: vi.fn((_: unknown, handler: (...args: any[]) => unknown) => handler),
}));

vi.mock('@/lib/audit/atomic-audit', () => ({ persistAtomicAudit: m.audit }));
vi.mock('@/lib/api/errors', () => ({ ApiError: { forbidden: (message: string) => Object.assign(new Error(message), { status: 403 }) } }));

vi.mock('@/db/schema', () => ({
  analyticsMetrics: {
    organizationId: 'organizationId',
    metricType: 'metricType',
    metricValue: 'metricValue',
    metricUnit: 'metricUnit',
    periodStart: 'periodStart',
    periodEnd: 'periodEnd',
    trend: 'trend',
    createdAt: 'createdAt',
  },
}));

// The read runs under the system role on purpose and is audited with the read (B89).
vi.mock('@/lib/db/with-rls-context', () => ({
  withSystemContext: m.withSystemContext,
}));

vi.mock('drizzle-orm', async (importOriginal) => {
  const actual = await importOriginal<typeof import('drizzle-orm')>();
  return {
    ...actual,
    desc: vi.fn((column: unknown) => ({ desc: column })),
  };
});

async function loadRoute() {
  return import('../analytics/cross-org/route');
}

describe('/api/analytics/cross-org route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.rows = [];
    m.select.mockImplementation(() => ({
      from: vi.fn(() => ({
        orderBy: vi.fn(() => ({
          limit: vi.fn(async () => m.rows),
        })),
      })),
    }));
  });

  it('returns aggregate-only metrics without raw organization rows', async () => {
    m.rows = [
      {
        organizationId: 'liuna-local-001',
        metricType: 'open_cases',
        metricValue: '4',
        metricUnit: 'count',
        periodStart: new Date('2026-08-01T00:00:00.000Z'),
        periodEnd: new Date('2026-08-31T23:59:59.000Z'),
        trend: 'up',
        metadata: { privilegedMatterId: 'do-not-expose' },
      },
      {
        organizationId: 'liuna-local-002',
        metricType: 'open_cases',
        metricValue: '6',
        metricUnit: 'count',
        periodStart: new Date('2026-08-01T00:00:00.000Z'),
        periodEnd: new Date('2026-08-31T23:59:59.000Z'),
        trend: 'stable',
        metadata: { memberId: 'do-not-expose' },
      },
    ];

    const { GET, dynamic } = await loadRoute();
    const result = await GET({ userId: 'u1', organizationId: 'org1' } as any);

    expect(dynamic).toBe('force-dynamic');
    expect(m.audit).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ action: 'analytics.cross_org.read', details: { sourceRowsAggregated: 2 } }));
    expect(result).toEqual({
      dataClass: 'aggregate_only',
      sourceRowsAggregated: 2,
      rawRowsExposed: false,
      items: [{
        metricType: 'open_cases',
        metricUnit: 'count',
        metricCount: 2,
        contributingOrganizations: 2,
        totalValue: 10,
        averageValue: 5,
        minValue: 4,
        maxValue: 6,
        periodStart: '2026-08-01T00:00:00.000Z',
        periodEnd: '2026-08-31T23:59:59.000Z',
        latestTrend: 'up',
      }],
    });

    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain('liuna-local-001');
    expect(serialized).not.toContain('liuna-local-002');
    expect(serialized).not.toContain('privilegedMatterId');
    expect(serialized).not.toContain('memberId');
  });

  it('refuses a caller with no active organization and reads nothing', async () => {
    const { GET } = await loadRoute();
    await expect(GET({ userId: 'u1', organizationId: null } as any)).rejects.toThrow('active organization');
    expect(m.select).not.toHaveBeenCalled();
  });
});
