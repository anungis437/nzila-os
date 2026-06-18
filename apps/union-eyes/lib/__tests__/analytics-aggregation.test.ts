import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  mockSelect: vi.fn(),
  mockFrom: vi.fn(),
  mockWhere: vi.fn(),
}));

vi.mock('@/db', () => ({
  db: {
    select: mocks.mockSelect.mockReturnValue({
      from: mocks.mockFrom.mockReturnValue({
        where: mocks.mockWhere,
      }),
    }),
  },
}));

vi.mock('@/db/schema', () => ({
  claims: {
    organizationId: 'organizationId',
    createdAt: 'createdAt',
    closedAt: 'closedAt',
    status: 'status',
    incidentDate: 'incidentDate',
  },
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((...args: any[]) => ({ op: 'eq', args })),
  and: vi.fn((...args: any[]) => ({ op: 'and', args })),
  gte: vi.fn((...args: any[]) => ({ op: 'gte', args })),
  sql: vi.fn((strings: TemplateStringsArray, ...values: any[]) => ({ strings, values })),
  count: vi.fn(() => 'count'),
  relations: vi.fn(() => ({})),
}));

import { aggregationService } from '../analytics-aggregation';

describe('AnalyticsAggregationService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('computeDailyAggregation returns aggregation data', async () => {
    // Each db.select().from().where() call returns a destructured array
    mocks.mockWhere
      .mockResolvedValueOnce([{ count: 5 }]) // newClaims
      .mockResolvedValueOnce([{ count: 2, avgResolutionTime: 7 }]) // resolvedClaims
      .mockResolvedValueOnce([{ total: 20, active: 10 }]) // totals
      .mockResolvedValueOnce([{ totalValue: 50000, totalSettlements: 20000, totalCosts: 5000 }]); // financials

    const result = await aggregationService.computeDailyAggregation('org-1', new Date());

    expect(result).toMatchObject({
      organizationId: 'org-1',
      totalClaims: 20,
      newClaims: 5,
      resolvedClaims: 2,
      activeClaims: 10,
    });
  });

  it('computeOrganizationMetrics returns metrics object', async () => {
    mocks.mockWhere
      .mockResolvedValueOnce([{ total: 50, active: 15, resolved: 30, avgResolutionDays: 12 }])
      .mockResolvedValueOnce([{ totalValue: 100000, totalSettlements: 60000, totalCosts: 10000 }])
      .mockResolvedValueOnce([{ queueSize: 15, avgWaitTime: 24, onTime: 25, resolved: 30 }]);

    const result = await aggregationService.computeOrganizationMetrics('org-1');

    expect(result.organizationId).toBe('org-1');
    expect(result.metrics.claims.total).toBe(50);
    expect(result.metrics.financial.totalValue).toBe(100000);
    expect(result.metrics.operational.queueSize).toBe(15);
  });

  it('computeRangeMetrics calls db with date range', async () => {
    mocks.mockWhere.mockResolvedValueOnce([{
      totalClaims: 10,
      newClaims: 3,
      resolvedClaims: 2,
      avgResolutionDays: 5,
      totalValue: 10000,
      totalSettlements: 4000,
    }]);

    const start = new Date('2025-01-01');
    const end = new Date('2025-01-31');
    const result = await aggregationService.computeRangeMetrics('org-1', start, end);

    expect(result.organizationId).toBe('org-1');
    expect(result.startDate).toBe(start);
    expect(result.endDate).toBe(end);
  });
});
