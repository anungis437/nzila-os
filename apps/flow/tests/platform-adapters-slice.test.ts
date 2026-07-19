import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  mockLogger,
  mockGetRegisteredCommandTypes,
  mockDbExecute,
  mockSelectWhere,
} = vi.hoisted(() => ({
  mockLogger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
  mockGetRegisteredCommandTypes: vi.fn(),
  mockDbExecute: vi.fn(),
  mockSelectWhere: vi.fn(),
}))

vi.mock('@/lib/logger', () => ({ logger: mockLogger }))
vi.mock('@/lib/control/command-bus', () => ({ getRegisteredCommandTypes: mockGetRegisteredCommandTypes }))

vi.mock('drizzle-orm', () => ({
  eq: vi.fn(() => ({})),
  and: vi.fn(() => ({})),
  gte: vi.fn(() => ({})),
  lte: vi.fn(() => ({})),
  count: vi.fn(() => 1),
  sql: vi.fn((x: TemplateStringsArray) => x.join('')),
}))

vi.mock('@nzila/db', () => {
  const selectChain = {
    from: vi.fn(() => selectChain),
    where: vi.fn(() => mockSelectWhere()),
    groupBy: vi.fn(() => []),
    limit: vi.fn(() => []),
  }
  return {
    db: {
      execute: mockDbExecute,
      select: vi.fn(() => selectChain),
    },
    flowDomainEvents: { orgId: 'orgId', createdAt: 'createdAt' },
    commerceOrders: { orgId: 'orgId', status: 'status', paymentStatus: 'paymentStatus' },
    flowProductionJobs: { orgId: 'orgId', status: 'status' },
    commerceQuotes: { orgId: 'orgId', status: 'status' },
    flowPayments: { orgId: 'orgId', createdAt: 'createdAt' },
  }
})

describe('platform adapters slice', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('health adapter returns healthy/degraded/unhealthy', async () => {
    const { healthAdapter } = await import('@/lib/platform-adapters/health-adapter')

    mockDbExecute.mockResolvedValueOnce([])
    mockGetRegisteredCommandTypes.mockReturnValueOnce(['a', 'b'])
    const healthy = await healthAdapter.check()
    expect(healthy.status).toBe('healthy')

    mockDbExecute.mockResolvedValueOnce([])
    mockGetRegisteredCommandTypes.mockReturnValueOnce([])
    const degraded = await healthAdapter.check()
    expect(degraded.status).toBe('degraded')

    mockDbExecute.mockRejectedValueOnce(new Error('db down'))
    mockGetRegisteredCommandTypes.mockReturnValueOnce(['x'])
    const unhealthy = await healthAdapter.check()
    expect(unhealthy.status).toBe('unhealthy')
  })

  it('metrics adapter collects quote/order/production/payment metrics', async () => {
    const { metricsAdapter } = await import('@/lib/platform-adapters/metrics-adapter')

    mockSelectWhere
      .mockReturnValueOnce({ groupBy: () => [{ status: 'draft', cnt: 2 }] })
      .mockReturnValueOnce({ groupBy: () => [{ status: 'confirmed', cnt: 3 }] })
      .mockReturnValueOnce([{ cnt: 4 }])
      .mockReturnValueOnce([{ total: 250 }])

    const summary = await metricsAdapter.collect('org-1')
    expect(summary.entries.length).toBeGreaterThanOrEqual(4)
  })

  it('evidence adapter exports artifacts and governance adapter computes checks', async () => {
    const { evidenceAdapter } = await import('@/lib/platform-adapters/evidence-adapter')
    const { governanceAdapter } = await import('@/lib/platform-adapters/governance-adapter')

    mockSelectWhere.mockReturnValueOnce([
      { id: 'e1', orgId: 'org-1', createdAt: new Date(), type: 'x' },
      { id: 'e2', orgId: 'org-1', createdAt: new Date(), type: 'y' },
    ])
    const exported = await evidenceAdapter.export('org-1', '2026-01-01', '2026-01-31')
    expect(exported.artifacts.length).toBe(1)

    mockGetRegisteredCommandTypes.mockReturnValueOnce(new Array(17).fill('h'))
    mockSelectWhere.mockReturnValueOnce([{ cnt: 0 }]).mockReturnValueOnce([{ cnt: 5 }])
    const pass = await governanceAdapter.evaluate('org-1')
    expect(pass.overall_result).toBe('pass')

    mockGetRegisteredCommandTypes.mockReturnValueOnce([])
    mockSelectWhere.mockImplementationOnce(() => {
      throw new Error('orders query fail')
    })
    mockSelectWhere.mockImplementationOnce(() => {
      throw new Error('jobs query fail')
    })
    const warn = await governanceAdapter.evaluate('org-1')
    expect(['warn', 'fail']).toContain(warn.overall_result)

    mockGetRegisteredCommandTypes.mockReturnValueOnce(new Array(17).fill('h'))
    mockSelectWhere.mockReturnValueOnce([{ cnt: 2 }]).mockReturnValueOnce([{ cnt: 1 }])
    const fail = await governanceAdapter.evaluate('org-1')
    expect(fail.overall_result).toBe('fail')
    expect(fail.checks.find(c => c.name === 'no_unpaid_production')?.message).toContain('2 orders')
  })

  it('barrel exports platform adapters', async () => {
    const exports = await import('@/lib/platform-adapters')
    expect(exports.healthAdapter).toBeTruthy()
    expect(exports.metricsAdapter).toBeTruthy()
    expect(exports.evidenceAdapter).toBeTruthy()
    expect(exports.governanceAdapter).toBeTruthy()
  })
})
