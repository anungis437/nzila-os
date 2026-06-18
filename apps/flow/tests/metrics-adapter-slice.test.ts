import { beforeEach, describe, expect, it, vi } from 'vitest'

const { qSelect, mockSelect, mockLoggerError } = vi.hoisted(() => ({
  qSelect: [] as unknown[][],
  mockSelect: vi.fn(),
  mockLoggerError: vi.fn(),
}))

const shiftQueue = () => Promise.resolve((qSelect.shift() ?? []) as never)

vi.mock('drizzle-orm', () => ({
  eq: vi.fn(() => ({})),
  and: vi.fn(() => ({})),
  gte: vi.fn(() => ({})),
  count: vi.fn(() => 'count'),
  sql: vi.fn(() => 0),
}))

vi.mock('@nzila/db', () => {
  const selectChain = {
    from: vi.fn(() => selectChain),
    where: vi.fn(() => selectChain),
    groupBy: vi.fn(() => shiftQueue()),
    then: (resolve: (value: unknown) => unknown, reject?: (error: unknown) => unknown) =>
      shiftQueue().then(resolve, reject),
  }

  mockSelect.mockImplementation(() => selectChain)

  return {
    db: {
      select: mockSelect,
    },
    commerceOrders: { orgId: 'orgId', status: 'status' },
    commerceQuotes: { orgId: 'orgId', status: 'status' },
    flowPayments: { orgId: 'orgId', createdAt: 'createdAt' },
    flowProductionJobs: { orgId: 'orgId', status: 'status' },
  }
})

vi.mock('@/lib/logger', () => ({
  logger: {
    error: mockLoggerError,
    info: vi.fn(),
    warn: vi.fn(),
  },
}))

describe('metrics adapter slice', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    qSelect.length = 0
  })

  it('collects all metric entries including unknown status fallback', async () => {
    const { metricsAdapter } = await import('@/lib/platform-adapters/metrics-adapter')

    qSelect.push(
      [
        { status: 'draft', cnt: 2 },
        { status: null, cnt: 1 },
      ],
      [
        { status: 'confirmed', cnt: 3 },
        { status: null, cnt: 1 },
      ],
      [{ cnt: 5 }],
      [{ total: '1250.50' }],
    )

    const result = await metricsAdapter.collect('org-1')

    expect(result.app).toBe('flow')
    expect(result.org_id).toBe('org-1')
    expect(result.entries).toHaveLength(6)

    const unknownQuote = result.entries.find((e) => e.name === 'flow.quotes.by_status' && e.labels.status === 'unknown')
    expect(unknownQuote?.value).toBe(1)

    const activeJobs = result.entries.find((e) => e.name === 'flow.production.active_jobs')
    expect(activeJobs?.value).toBe(5)

    const payment30d = result.entries.find((e) => e.name === 'flow.payments.total_30d')
    expect(payment30d?.value).toBe(1250.5)
  })

  it('logs and returns summary with empty entries when collection fails', async () => {
    const { metricsAdapter } = await import('@/lib/platform-adapters/metrics-adapter')

    mockSelect.mockImplementationOnce(() => {
      throw new Error('db down')
    })

    const result = await metricsAdapter.collect('org-1')

    expect(result.app).toBe('flow')
    expect(result.org_id).toBe('org-1')
    expect(result.entries).toEqual([])
    expect(mockLoggerError).toHaveBeenCalledWith('Metrics collection failed', { error: 'db down' })
  })
})
