/**
 * Nzila OS — Platform Metrics comprehensive unit tests
 *
 * Covers all branches in org-metrics.ts and platform-metrics.ts
 * with mocked Drizzle DB chains. Targets 95%+ statement & branch coverage.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Hoisted mock references ─────────────────────────────────────────────────

const mocks = vi.hoisted(() => ({
  selectMock: vi.fn(),
}))

// ── Module mocks ────────────────────────────────────────────────────────────

vi.mock('@nzila/db/platform', () => ({
  platformDb: { select: mocks.selectMock },
}))

vi.mock('@nzila/db/schema', () => ({
  orgs: {},
  auditEvents: { orgId: 'org_id', createdAt: 'created_at' },
  ueCases: {
    orgId: 'org_id',
    status: 'status',
    slaBreached: 'sla_breached',
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  },
  zongaRevenueEvents: {
    orgId: 'org_id',
    amount: 'amount',
    createdAt: 'created_at',
  },
  commerceCustomers: { orgId: 'org_id', createdAt: 'created_at' },
  commerceQuotes: { orgId: 'org_id' },
  automationCommands: { status: 'status', orgId: 'org_id' },
  nacpExamSessions: { orgId: 'org_id', status: 'status' },
}))

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((...args: unknown[]) => args),
  count: vi.fn(() => ({ as: vi.fn(() => 'count_col') })),
  sql: vi.fn((...args: unknown[]) => ({ as: vi.fn(() => 'sql_col') })),
  and: vi.fn((...args: unknown[]) => args),
  gte: vi.fn((...args: unknown[]) => args),
}))

// ── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Creates a chainable select mock that resolves to `resolvedValue`.
 * Handles both `.from(t).where(...)` and bare `.from(t)` call patterns.
 */
function chainable(resolvedValue: unknown[]) {
  return {
    from: vi.fn(() =>
      Object.assign(Promise.resolve(resolvedValue), {
        where: vi.fn().mockResolvedValue(resolvedValue),
      }),
    ),
  }
}

// ── SUT imports ─────────────────────────────────────────────────────────────

import { getOrgPerformanceMetrics } from '../org-metrics'
import {
  getPlatformOverviewMetrics,
  getOrgOverviewMetrics,
} from '../platform-metrics'

// ═══════════════════════════════════════════════════════════════════════════
//  org-metrics.ts — getOrgPerformanceMetrics
// ═══════════════════════════════════════════════════════════════════════════

describe('getOrgPerformanceMetrics', () => {
  beforeEach(() => {
    mocks.selectMock.mockReset()
  })

  /**
   * Wire up 5 sequential select() calls:
   *  1. efficiency → [{avgDays}]
   *  2. sla        → [{total, onTime}]
   *  3. revenue    → [{totalRevenue}]
   *  4. engagement/audit    → [{total}]
   *  5. engagement/customer → [{total}]
   */
  function setupOrgMocks(overrides: {
    efficiency?: unknown[]
    sla?: unknown[]
    revenue?: unknown[]
    auditCount?: unknown[]
    customerCount?: unknown[]
  } = {}) {
    const {
      efficiency = [{ avgDays: 7 }],
      sla = [{ total: 100, onTime: 90 }],
      revenue = [{ totalRevenue: 3000 }],
      auditCount = [{ total: 20 }],
      customerCount = [{ total: 5 }],
    } = overrides

    mocks.selectMock
      .mockImplementationOnce(() => chainable(efficiency))
      .mockImplementationOnce(() => chainable(sla))
      .mockImplementationOnce(() => chainable(revenue))
      .mockImplementationOnce(() => chainable(auditCount))
      .mockImplementationOnce(() => chainable(customerCount))
  }

  // ── default window ────────────────────────────────────────────────────

  it('returns metrics with default 30-day window', async () => {
    setupOrgMocks()

    const result = await getOrgPerformanceMetrics('org_1')

    expect(result).toEqual({
      operationalEfficiency: 0.5,    // (14-7)/14
      slaAdherence: 90,              // 90/100*100
      revenueVelocity: 100,          // 3000/30
      userEngagementScore: 35,       // min(50,10)+min(50,25)
    })
    expect(mocks.selectMock).toHaveBeenCalledTimes(5)
  })

  // ── custom window ─────────────────────────────────────────────────────

  it('uses custom windowDays for revenue velocity', async () => {
    setupOrgMocks({ revenue: [{ totalRevenue: 600 }] })

    const result = await getOrgPerformanceMetrics('org_1', { windowDays: 10 })

    expect(result.revenueVelocity).toBe(60) // 600/10
  })

  it('uses custom windowDays = 1', async () => {
    setupOrgMocks({ revenue: [{ totalRevenue: 50 }] })

    const result = await getOrgPerformanceMetrics('org_1', { windowDays: 1 })

    expect(result.revenueVelocity).toBe(50) // 50/1
  })

  // ── Efficiency branches ───────────────────────────────────────────────

  it('efficiency: avg < baseline → positive', async () => {
    setupOrgMocks({ efficiency: [{ avgDays: 7 }] })
    const r = await getOrgPerformanceMetrics('org_1')
    expect(r.operationalEfficiency).toBeCloseTo(0.5)
  })

  it('efficiency: avg === baseline → 0', async () => {
    setupOrgMocks({ efficiency: [{ avgDays: 14 }] })
    const r = await getOrgPerformanceMetrics('org_1')
    expect(r.operationalEfficiency).toBe(0)
  })

  it('efficiency: avg > baseline → clamped to 0', async () => {
    setupOrgMocks({ efficiency: [{ avgDays: 28 }] })
    const r = await getOrgPerformanceMetrics('org_1')
    expect(r.operationalEfficiency).toBe(0)
  })

  it('efficiency: avg = 0 → clamped to 1 (max)', async () => {
    setupOrgMocks({ efficiency: [{ avgDays: 0 }] })
    const r = await getOrgPerformanceMetrics('org_1')
    expect(r.operationalEfficiency).toBe(1)
  })

  it('efficiency: no data (undefined avgDays) → uses baseline → 0', async () => {
    setupOrgMocks({ efficiency: [{}] })
    const r = await getOrgPerformanceMetrics('org_1')
    expect(r.operationalEfficiency).toBe(0)
  })

  it('efficiency: empty result array → uses baseline → 0', async () => {
    setupOrgMocks({ efficiency: [] })
    const r = await getOrgPerformanceMetrics('org_1')
    expect(r.operationalEfficiency).toBe(0)
  })

  // ── SLA branches ──────────────────────────────────────────────────────

  it('SLA: total = 0 → 100 (perfect by convention)', async () => {
    setupOrgMocks({ sla: [{ total: 0, onTime: 0 }] })
    const r = await getOrgPerformanceMetrics('org_1')
    expect(r.slaAdherence).toBe(100)
  })

  it('SLA: some breached', async () => {
    setupOrgMocks({ sla: [{ total: 200, onTime: 150 }] })
    const r = await getOrgPerformanceMetrics('org_1')
    expect(r.slaAdherence).toBe(75)
  })

  it('SLA: all on time → 100', async () => {
    setupOrgMocks({ sla: [{ total: 50, onTime: 50 }] })
    const r = await getOrgPerformanceMetrics('org_1')
    expect(r.slaAdherence).toBe(100)
  })

  it('SLA: none on time → 0', async () => {
    setupOrgMocks({ sla: [{ total: 80, onTime: 0 }] })
    const r = await getOrgPerformanceMetrics('org_1')
    expect(r.slaAdherence).toBe(0)
  })

  it('SLA: empty array → destructures to {total:0,onTime:0} → 100', async () => {
    setupOrgMocks({ sla: [] })
    const r = await getOrgPerformanceMetrics('org_1')
    expect(r.slaAdherence).toBe(100)
  })

  // ── Revenue branches ──────────────────────────────────────────────────

  it('revenue: zero → 0', async () => {
    setupOrgMocks({ revenue: [{ totalRevenue: 0 }] })
    const r = await getOrgPerformanceMetrics('org_1')
    expect(r.revenueVelocity).toBe(0)
  })

  it('revenue: normal', async () => {
    setupOrgMocks({ revenue: [{ totalRevenue: 1500 }] })
    const r = await getOrgPerformanceMetrics('org_1')
    expect(r.revenueVelocity).toBe(50) // 1500/30
  })

  it('revenue: empty result → fallback 0', async () => {
    setupOrgMocks({ revenue: [] })
    const r = await getOrgPerformanceMetrics('org_1')
    expect(r.revenueVelocity).toBe(0)
  })

  it('revenue: undefined totalRevenue → fallback 0', async () => {
    setupOrgMocks({ revenue: [{}] })
    const r = await getOrgPerformanceMetrics('org_1')
    expect(r.revenueVelocity).toBe(0)
  })

  // ── Engagement branches ───────────────────────────────────────────────

  it('engagement: moderate counts → composite', async () => {
    setupOrgMocks({ auditCount: [{ total: 40 }], customerCount: [{ total: 6 }] })
    const r = await getOrgPerformanceMetrics('org_1')
    // min(50,40/2=20) + min(50,6*5=30) = 50
    expect(r.userEngagementScore).toBe(50)
  })

  it('engagement: very high counts → capped at 100', async () => {
    setupOrgMocks({ auditCount: [{ total: 200 }], customerCount: [{ total: 20 }] })
    const r = await getOrgPerformanceMetrics('org_1')
    // min(50,100)=50 + min(50,100)=50
    expect(r.userEngagementScore).toBe(100)
  })

  it('engagement: zero counts → 0', async () => {
    setupOrgMocks({ auditCount: [{ total: 0 }], customerCount: [{ total: 0 }] })
    const r = await getOrgPerformanceMetrics('org_1')
    expect(r.userEngagementScore).toBe(0)
  })

  it('engagement: empty results → fallback 0', async () => {
    setupOrgMocks({ auditCount: [], customerCount: [] })
    const r = await getOrgPerformanceMetrics('org_1')
    expect(r.userEngagementScore).toBe(0)
  })

  it('engagement: only audit activity → max 50', async () => {
    setupOrgMocks({ auditCount: [{ total: 500 }], customerCount: [{ total: 0 }] })
    const r = await getOrgPerformanceMetrics('org_1')
    expect(r.userEngagementScore).toBe(50)
  })

  it('engagement: only customer activity → max 50', async () => {
    setupOrgMocks({ auditCount: [{ total: 0 }], customerCount: [{ total: 100 }] })
    const r = await getOrgPerformanceMetrics('org_1')
    expect(r.userEngagementScore).toBe(50)
  })

  it('engagement: fractional audit → rounds', async () => {
    // 11/2 = 5.5 + 3*5 = 15 → 20.5 → round to 21
    setupOrgMocks({ auditCount: [{ total: 11 }], customerCount: [{ total: 3 }] })
    const r = await getOrgPerformanceMetrics('org_1')
    expect(r.userEngagementScore).toBe(21) // Math.round(5.5+15)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
//  platform-metrics.ts — getPlatformOverviewMetrics
// ═══════════════════════════════════════════════════════════════════════════

describe('getPlatformOverviewMetrics', () => {
  beforeEach(() => {
    mocks.selectMock.mockReset()
  })

  /**
   * 7 sequential select() calls:
   * orgs, auditEvents, automationCommands(.where), nacpExamSessions(.where),
   * zongaRevenueEvents, ueCases, commerceQuotes
   */
  function setupPlatformMocks(values: number[]) {
    for (const v of values) {
      mocks.selectMock.mockImplementationOnce(() => chainable([{ total: v }]))
    }
  }

  it('returns all counts + systemVersion', async () => {
    setupPlatformMocks([10, 500, 42, 8, 150, 200, 75])

    const result = await getPlatformOverviewMetrics('2.1.0')

    expect(result).toEqual({
      totalOrgs: 10,
      activeAppsPerOrg: {},
      totalAuditEvents: 500,
      totalBackgroundJobs: 42,
      activeSessions: 8,
      revenueEventsProcessed: 150,
      claimsProcessed: 200,
      quotesGenerated: 75,
      systemVersion: '2.1.0',
    })
    expect(mocks.selectMock).toHaveBeenCalledTimes(7)
  })

  it('handles empty result arrays (all ?? 0)', async () => {
    for (let i = 0; i < 7; i++) {
      mocks.selectMock.mockImplementationOnce(() => chainable([]))
    }

    const result = await getPlatformOverviewMetrics('0.0.1')

    expect(result).toEqual({
      totalOrgs: 0,
      activeAppsPerOrg: {},
      totalAuditEvents: 0,
      totalBackgroundJobs: 0,
      activeSessions: 0,
      revenueEventsProcessed: 0,
      claimsProcessed: 0,
      quotesGenerated: 0,
      systemVersion: '0.0.1',
    })
  })

  it('handles undefined total in result objects', async () => {
    for (let i = 0; i < 7; i++) {
      mocks.selectMock.mockImplementationOnce(() => chainable([{}]))
    }

    const result = await getPlatformOverviewMetrics('1.0.0')

    expect(result.totalOrgs).toBe(0)
    expect(result.totalAuditEvents).toBe(0)
    expect(result.totalBackgroundJobs).toBe(0)
    expect(result.activeSessions).toBe(0)
    expect(result.revenueEventsProcessed).toBe(0)
    expect(result.claimsProcessed).toBe(0)
    expect(result.quotesGenerated).toBe(0)
  })

  it('passes systemVersion through unchanged', async () => {
    setupPlatformMocks([0, 0, 0, 0, 0, 0, 0])
    const result = await getPlatformOverviewMetrics('nightly-42')
    expect(result.systemVersion).toBe('nightly-42')
  })

  it('activeAppsPerOrg is always an empty object', async () => {
    setupPlatformMocks([5, 1, 1, 1, 1, 1, 1])
    const result = await getPlatformOverviewMetrics('v1')
    expect(result.activeAppsPerOrg).toEqual({})
  })
})

// ═══════════════════════════════════════════════════════════════════════════
//  platform-metrics.ts — getOrgOverviewMetrics
// ═══════════════════════════════════════════════════════════════════════════

describe('getOrgOverviewMetrics', () => {
  beforeEach(() => {
    mocks.selectMock.mockReset()
  })

  /**
   * 6 sequential select() calls (all with .where):
   * auditEvents, automationCommands, nacpExamSessions,
   * zongaRevenueEvents, ueCases, commerceQuotes
   */
  function setupOrgOverviewMocks(values: number[]) {
    for (const v of values) {
      mocks.selectMock.mockImplementationOnce(() => chainable([{ total: v }]))
    }
  }

  it('returns org-scoped counts', async () => {
    setupOrgOverviewMocks([100, 20, 3, 50, 80, 15])

    const result = await getOrgOverviewMetrics('org_42')

    expect(result).toEqual({
      totalAuditEvents: 100,
      totalBackgroundJobs: 20,
      activeSessions: 3,
      revenueEventsProcessed: 50,
      claimsProcessed: 80,
      quotesGenerated: 15,
    })
    expect(mocks.selectMock).toHaveBeenCalledTimes(6)
  })

  it('handles empty result arrays (all ?? 0)', async () => {
    for (let i = 0; i < 6; i++) {
      mocks.selectMock.mockImplementationOnce(() => chainable([]))
    }

    const result = await getOrgOverviewMetrics('org_empty')

    expect(result).toEqual({
      totalAuditEvents: 0,
      totalBackgroundJobs: 0,
      activeSessions: 0,
      revenueEventsProcessed: 0,
      claimsProcessed: 0,
      quotesGenerated: 0,
    })
  })

  it('handles undefined total in result objects', async () => {
    for (let i = 0; i < 6; i++) {
      mocks.selectMock.mockImplementationOnce(() => chainable([{}]))
    }

    const result = await getOrgOverviewMetrics('org_partial')

    expect(result.totalAuditEvents).toBe(0)
    expect(result.totalBackgroundJobs).toBe(0)
    expect(result.activeSessions).toBe(0)
    expect(result.revenueEventsProcessed).toBe(0)
    expect(result.claimsProcessed).toBe(0)
    expect(result.quotesGenerated).toBe(0)
  })

  it('handles mixed present and missing counts', async () => {
    mocks.selectMock
      .mockImplementationOnce(() => chainable([{ total: 42 }]))  // audit
      .mockImplementationOnce(() => chainable([]))                // jobs — empty
      .mockImplementationOnce(() => chainable([{ total: 5 }]))   // sessions
      .mockImplementationOnce(() => chainable([{}]))              // revenue — undef
      .mockImplementationOnce(() => chainable([{ total: 10 }]))  // claims
      .mockImplementationOnce(() => chainable([]))                // quotes — empty

    const result = await getOrgOverviewMetrics('org_mixed')

    expect(result).toEqual({
      totalAuditEvents: 42,
      totalBackgroundJobs: 0,
      activeSessions: 5,
      revenueEventsProcessed: 0,
      claimsProcessed: 10,
      quotesGenerated: 0,
    })
  })
})

// ═══════════════════════════════════════════════════════════════════════════
//  index.ts — public API surface
// ═══════════════════════════════════════════════════════════════════════════

describe('package exports', () => {
  it('re-exports getOrgPerformanceMetrics', async () => {
    const mod = await import('../index')
    expect(typeof mod.getOrgPerformanceMetrics).toBe('function')
  })

  it('re-exports getPlatformOverviewMetrics', async () => {
    const mod = await import('../index')
    expect(typeof mod.getPlatformOverviewMetrics).toBe('function')
  })

  it('re-exports getOrgOverviewMetrics', async () => {
    const mod = await import('../index')
    expect(typeof mod.getOrgOverviewMetrics).toBe('function')
  })
})
