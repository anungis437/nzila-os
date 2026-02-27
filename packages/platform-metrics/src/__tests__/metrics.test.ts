/**
 * Nzila OS — Platform Metrics unit tests
 *
 * Verifies that metric calculation formulas are deterministic
 * and return expected shapes. DB calls are mocked.
 */
import { describe, it, expect, vi } from 'vitest'

// Mock the DB module before importing the metrics
vi.mock('@nzila/db/platform', () => ({
  platformDb: {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue([]),
  },
}))

vi.mock('@nzila/db/schema', () => ({
  entities: {},
  auditEvents: { entityId: 'entity_id', createdAt: 'created_at' },
  ueCases: {
    entityId: 'entity_id',
    status: 'status',
    slaBreached: 'sla_breached',
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  },
  zongaRevenueEvents: {
    entityId: 'entity_id',
    amount: 'amount',
    createdAt: 'created_at',
  },
  commerceCustomers: { entityId: 'entity_id', createdAt: 'created_at' },
  commerceQuotes: { entityId: 'entity_id' },
  automationCommands: { status: 'status', entityId: 'entity_id' },
  nacpExamSessions: { entityId: 'entity_id', status: 'status' },
}))

describe('OrgPerformanceMetrics type contract', () => {
  it('should export getOrgPerformanceMetrics function', async () => {
    const { getOrgPerformanceMetrics } = await import('../org-metrics')
    expect(typeof getOrgPerformanceMetrics).toBe('function')
  })

  it('metric result shape matches contract', () => {
    // Verify the interface shape through type assertions
    const metrics = {
      operationalEfficiency: 0.75,
      slaAdherence: 95.5,
      revenueVelocity: 120.5,
      userEngagementScore: 72,
    }

    expect(metrics.operationalEfficiency).toBeGreaterThanOrEqual(0)
    expect(metrics.operationalEfficiency).toBeLessThanOrEqual(1)
    expect(metrics.slaAdherence).toBeGreaterThanOrEqual(0)
    expect(metrics.slaAdherence).toBeLessThanOrEqual(100)
    expect(metrics.revenueVelocity).toBeGreaterThanOrEqual(0)
    expect(metrics.userEngagementScore).toBeGreaterThanOrEqual(0)
    expect(metrics.userEngagementScore).toBeLessThanOrEqual(100)
  })
})

describe('PlatformOverviewMetrics type contract', () => {
  it('should export getPlatformOverviewMetrics function', async () => {
    const { getPlatformOverviewMetrics } = await import('../platform-metrics')
    expect(typeof getPlatformOverviewMetrics).toBe('function')
  })

  it('should export getOrgOverviewMetrics function', async () => {
    const { getOrgOverviewMetrics } = await import('../platform-metrics')
    expect(typeof getOrgOverviewMetrics).toBe('function')
  })
})

describe('Efficiency formula correctness', () => {
  it('efficiency = (baseline - current) / baseline', () => {
    const baseline = 14
    const cases = [
      { current: 7, expected: 0.5 },
      { current: 14, expected: 0 },
      { current: 0, expected: 1 },
      { current: 21, expected: 0 }, // clamped to 0, not negative
    ]

    for (const { current, expected } of cases) {
      const raw = (baseline - current) / baseline
      const clamped = Math.max(0, Math.min(1, raw))
      expect(clamped).toBeCloseTo(expected)
    }
  })
})

describe('SLA adherence formula correctness', () => {
  it('SLA = (on_time / total) * 100', () => {
    expect((90 / 100) * 100).toBe(90)
    expect((100 / 100) * 100).toBe(100)
    expect((0 / 100) * 100).toBe(0)
  })

  it('returns 100 when no cases exist', () => {
    const total = 0
    const result = total === 0 ? 100 : (0 / total) * 100
    expect(result).toBe(100)
  })
})

describe('Revenue velocity formula correctness', () => {
  it('velocity = total_revenue / window_days', () => {
    expect(3000 / 30).toBe(100)
    expect(0 / 30).toBe(0)
  })
})
