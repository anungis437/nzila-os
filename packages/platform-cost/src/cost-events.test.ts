import { describe, it, expect, vi } from 'vitest'
import {
  CostEventSchema,
  recordCostEvent,
  computeDailyRollups,
  getOrgCostSummary,
  projectMonthlyBurn,
  getTopCostDrivers,
  type CostStorePorts,
  type CostEvent,
} from './cost-events'

const ORG_ID = '00000000-0000-0000-0000-000000000001'

function makeMockPorts(overrides?: Partial<CostStorePorts>): CostStorePorts {
  return {
    insertCostEvent: vi.fn().mockResolvedValue({ id: 'evt-1' }),
    queryCostEvents: vi.fn().mockResolvedValue([]),
    upsertDailyRollup: vi.fn().mockResolvedValue(undefined),
    queryDailyRollups: vi.fn().mockResolvedValue([]),
    queryOrgTotalCost: vi.fn().mockResolvedValue({ totalEstCostUsd: 0, eventCount: 0 }),
    queryGlobalRollups: vi.fn().mockResolvedValue([]),
    ...overrides,
  }
}

describe('CostEventSchema', () => {
  it('validates a correct cost event', () => {
    const event = {
      orgId: ORG_ID,
      appId: 'console',
      category: 'compute_ms' as const,
      units: 150,
      estCostUsd: 0.001,
      ts: new Date(),
    }
    expect(CostEventSchema.parse(event)).toMatchObject({ orgId: ORG_ID, category: 'compute_ms' })
  })

  it('rejects invalid category', () => {
    const event = {
      orgId: ORG_ID,
      appId: 'console',
      category: 'invalid',
      units: 150,
      estCostUsd: 0.001,
      ts: new Date(),
    }
    expect(() => CostEventSchema.parse(event)).toThrow()
  })

  it('rejects negative units', () => {
    const event = {
      orgId: ORG_ID,
      appId: 'console',
      category: 'compute_ms',
      units: -1,
      estCostUsd: 0.001,
      ts: new Date(),
    }
    expect(() => CostEventSchema.parse(event)).toThrow()
  })
})

describe('recordCostEvent', () => {
  it('validates and inserts event', async () => {
    const ports = makeMockPorts()
    const event: CostEvent = {
      orgId: ORG_ID,
      appId: 'web',
      category: 'db_query_ms',
      units: 42,
      estCostUsd: 0.0005,
      ts: new Date('2026-03-01T12:00:00Z'),
    }
    const result = await recordCostEvent(event, ports)
    expect(result.id).toBe('evt-1')
    expect(ports.insertCostEvent).toHaveBeenCalledOnce()
  })
})

describe('computeDailyRollups', () => {
  it('aggregates events by appId+category', async () => {
    const events: CostEvent[] = [
      { orgId: ORG_ID, appId: 'web', category: 'compute_ms', units: 100, estCostUsd: 0.01, ts: new Date('2026-03-01T10:00:00Z') },
      { orgId: ORG_ID, appId: 'web', category: 'compute_ms', units: 200, estCostUsd: 0.02, ts: new Date('2026-03-01T14:00:00Z') },
      { orgId: ORG_ID, appId: 'console', category: 'db_query_ms', units: 50, estCostUsd: 0.005, ts: new Date('2026-03-01T16:00:00Z') },
    ]
    const ports = makeMockPorts({ queryCostEvents: vi.fn().mockResolvedValue(events) })

    const rollups = await computeDailyRollups({ orgId: ORG_ID, day: '2026-03-01' }, ports)

    expect(rollups).toHaveLength(2)
    const webCompute = rollups.find((r) => r.appId === 'web')
    expect(webCompute?.totalUnits).toBe(300)
    expect(webCompute?.totalEstCostUsd).toBe(0.03)
    expect(webCompute?.eventCount).toBe(2)
    expect(ports.upsertDailyRollup).toHaveBeenCalledTimes(2)
  })

  it('returns empty for no events', async () => {
    const ports = makeMockPorts()
    const rollups = await computeDailyRollups({ orgId: ORG_ID, day: '2026-03-01' }, ports)
    expect(rollups).toHaveLength(0)
  })
})

describe('projectMonthlyBurn', () => {
  it('projects 30-day burn from 7-day window', () => {
    const trend = Array.from({ length: 7 }, (_, i) => ({
      day: `2026-03-0${i + 1}`,
      totalEstCostUsd: 10,
    }))
    const result = projectMonthlyBurn(trend, 7)
    expect(result.avgDailyUsd).toBe(10)
    expect(result.projectedMonthlyUsd).toBe(300)
    expect(result.windowDays).toBe(7)
  })

  it('returns zero for empty trend', () => {
    const result = projectMonthlyBurn([], 7)
    expect(result.projectedMonthlyUsd).toBe(0)
  })
})

describe('getOrgCostSummary', () => {
  it('produces summary with categories and app breakdown', async () => {
    const ports = makeMockPorts({
      queryDailyRollups: vi.fn().mockResolvedValue([
        { orgId: ORG_ID, appId: 'web', category: 'compute_ms', day: '2026-03-01', totalUnits: 100, totalEstCostUsd: 5.0, eventCount: 10 },
        { orgId: ORG_ID, appId: 'console', category: 'db_query_ms', day: '2026-03-01', totalUnits: 50, totalEstCostUsd: 2.0, eventCount: 5 },
      ]),
      queryOrgTotalCost: vi.fn().mockResolvedValue({ totalEstCostUsd: 7.0, eventCount: 15 }),
    })

    const summary = await getOrgCostSummary(
      { orgId: ORG_ID, from: '2026-03-01', to: '2026-03-31' },
      ports,
    )

    expect(summary.totalEstCostUsd).toBe(7.0)
    expect(summary.byCategory.compute_ms).toBe(5.0)
    expect(summary.byCategory.db_query_ms).toBe(2.0)
    expect(summary.byApp.web).toBe(5.0)
    expect(summary.dailyTrend).toHaveLength(1)
  })
})

describe('getTopCostDrivers', () => {
  it('returns sorted drivers', async () => {
    const ports = makeMockPorts({
      queryDailyRollups: vi.fn().mockResolvedValue([
        { orgId: ORG_ID, appId: 'web', category: 'compute_ms', day: '2026-03-01', totalUnits: 100, totalEstCostUsd: 10.0, eventCount: 5 },
        { orgId: ORG_ID, appId: 'web', category: 'compute_ms', day: '2026-03-02', totalUnits: 200, totalEstCostUsd: 20.0, eventCount: 10 },
        { orgId: ORG_ID, appId: 'console', category: 'egress_kb', day: '2026-03-01', totalUnits: 1000, totalEstCostUsd: 5.0, eventCount: 2 },
      ]),
    })

    const drivers = await getTopCostDrivers(
      { orgId: ORG_ID, from: '2026-03-01', to: '2026-03-31', limit: 5 },
      ports,
    )

    expect(drivers[0].appId).toBe('web')
    expect(drivers[0].totalEstCostUsd).toBe(30.0)
    expect(drivers[1].totalEstCostUsd).toBe(5.0)
  })

  it('uses the default top-10 limit when none is provided', async () => {
    const rollups = Array.from({ length: 12 }, (_, index) => ({
      orgId: ORG_ID,
      appId: `app-${index}`,
      category: 'compute_ms' as const,
      day: '2026-03-01',
      totalUnits: index + 1,
      totalEstCostUsd: 100 - index,
      eventCount: 1,
    }))

    const ports = makeMockPorts({
      queryDailyRollups: vi.fn().mockResolvedValue(rollups),
    })

    const drivers = await getTopCostDrivers(
      { orgId: ORG_ID, from: '2026-03-01', to: '2026-03-31' },
      ports,
    )

    expect(drivers).toHaveLength(10)
    expect(drivers[0].appId).toBe('app-0')
    expect(drivers[9].appId).toBe('app-9')
  })
})
