import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
  rows: [] as Array<Record<string, unknown>>,
  select: vi.fn(),
  withRLSContext: vi.fn((handler: () => unknown) => handler()),
}));

vi.mock('@/lib/api/with-api', () => ({
  withApi: vi.fn((_: unknown, handler: (...args: any[]) => unknown) => handler),
}));

vi.mock('@/db/db', () => ({
  db: {
    select: m.select,
  },
}));

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

vi.mock('@/lib/db/with-rls-context', () => ({
  withRLSContext: m.withRLSContext,
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
    const result = await GET({} as any);

    expect(dynamic).toBe('force-dynamic');
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
});
