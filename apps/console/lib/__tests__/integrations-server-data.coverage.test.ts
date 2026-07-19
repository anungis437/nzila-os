import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('../integrations-provider-catalog', () => ({
  listProviderDefinitions: () => [
    { key: 'resend', displayName: 'Resend', channel: 'email', requiredSecrets: ['apiKey'] },
    { key: 'hubspot', displayName: 'HubSpot', channel: 'crm', requiredSecrets: ['apiKey'] },
  ],
}))

import {
  getCostDashboardData,
  getDlqEntries,
  getIntegrationDeliveries,
  getIntegrationProviders,
  getMarketplaceProviders,
  getOpsScoreHistory,
  getProviderHealthDetail,
  getProviderHealthList,
  getSloResults,
} from '../server-data'

describe('integrations server-data coverage', () => {
  const originalAppUrl = process.env.NEXT_PUBLIC_APP_URL

  afterEach(() => {
    process.env.NEXT_PUBLIC_APP_URL = originalAppUrl
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('returns marketplace provider seeds from catalog definitions', async () => {
    const providers = await getMarketplaceProviders()
    expect(providers).toHaveLength(2)
    expect(providers[0]).toMatchObject({ installed: false, status: 'inactive' })
  })

  it('returns seeded integration providers without base URL and mapped providers when API responds', async () => {
    delete process.env.NEXT_PUBLIC_APP_URL
    const seeded = await getIntegrationProviders()
    expect(seeded.length).toBeGreaterThan(0)
    expect(seeded.every((r) => r.status === 'down')).toBe(true)

    process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3001'
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        providers: [
          {
            provider: 'hubspot',
            status: 'unknown',
            lastCheckedAt: '2026-01-01T00:00:00.000Z',
            consecutiveFailures: 1,
          },
        ],
      }),
    }))

    const fromApi = await getIntegrationProviders()
    expect(fromApi).toEqual([
      {
        providerId: 'hubspot',
        orgId: 'org_default',
        status: 'down',
        lastCheckedAt: '2026-01-01T00:00:00.000Z',
        webhookVerified: false,
        rateLimitUsage: 0,
        dlqDepth: 0,
      },
    ])

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, json: async () => ({}) }))
    const fallback = await getIntegrationProviders()
    expect(fallback.length).toBeGreaterThan(0)
    expect(fallback.every((row) => row.status === 'down')).toBe(true)
  })

  it('returns DLQ and deliveries safely for missing org and from API responses', async () => {
    expect(await getDlqEntries()).toEqual([])
    expect(await getIntegrationDeliveries()).toEqual([])

    process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3001'
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ entries: [{ entryId: 'e1' }] }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ entries: [{ id: 'd1' }] }) })
    vi.stubGlobal('fetch', fetchMock)

    await expect(getDlqEntries('org_1')).resolves.toEqual([{ entryId: 'e1' }])
    await expect(getIntegrationDeliveries({ orgId: 'org_1', provider: 'hubspot', status: 'failed' })).resolves.toEqual([{ id: 'd1' }])
    expect(fetchMock.mock.calls[1][0]).toContain('provider=hubspot')
    expect(fetchMock.mock.calls[1][0]).toContain('status=failed')

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, json: async () => ({}) }))
    await expect(getDlqEntries('org_1')).resolves.toEqual([])
    await expect(getIntegrationDeliveries({ orgId: 'org_1' })).resolves.toEqual([])

    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({}) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({}) }))
    await expect(getDlqEntries('org_1')).resolves.toEqual([])
    await expect(getIntegrationDeliveries({ orgId: 'org_1', provider: null, status: null })).resolves.toEqual([])

    const toStringSpy = vi.spyOn(URLSearchParams.prototype, 'toString').mockReturnValueOnce('')
    const qFetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ entries: [] }) })
    vi.stubGlobal('fetch', qFetch)
    await getIntegrationDeliveries({ orgId: 'org_1' })
    expect(String(qFetch.mock.calls[0][0])).toContain('/api/integrations/deliveries')
    expect(String(qFetch.mock.calls[0][0])).not.toContain('?')
    toStringSpy.mockRestore()

    delete process.env.NEXT_PUBLIC_APP_URL
    await expect(getDlqEntries('org_1')).resolves.toEqual([])
    await expect(getIntegrationDeliveries({ orgId: 'org_1' })).resolves.toEqual([])
  })

  it('handles SLO, provider list/detail and fallbacks', async () => {
    process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3001'
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ results: [{ provider: 'resend', compliant: true }] }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ providers: [{ provider: 'resend', status: 'degraded', successRate: 0.95, avgLatencyMs: 321, circuitState: 'half-open', consecutiveFailures: 2, lastCheckedAt: 'now' }] }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ health: { status: 'ok' }, metrics: { successRate: 99 } }) }))

    await expect(getSloResults()).resolves.toEqual([{ provider: 'resend', compliant: true }])
    await expect(getProviderHealthList()).resolves.toEqual([
      {
        provider: 'resend',
        displayName: 'Resend',
        status: 'degraded',
        successRate: 95,
        p95LatencyMs: 321,
        rateLimitedCount: 0,
        circuitState: 'half_open',
        consecutiveFailures: 2,
        lastCheckedAt: 'now',
      },
    ])
    await expect(getProviderHealthDetail('resend')).resolves.toEqual({ health: { status: 'ok' }, metrics: { successRate: 99 } })

    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('boom') }))
    const fallback = await getProviderHealthDetail('resend')
    expect(fallback.health.lastErrorCode).toBe('no_data')

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, json: async () => ({}) }))
    const fallbackSlo = await getSloResults()
    expect(fallbackSlo.length).toBeGreaterThan(0)

    const fallbackHealth = await getProviderHealthList()
    expect(fallbackHealth.length).toBeGreaterThan(0)

    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ results: [] }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ providers: [] }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({}) })
      .mockResolvedValueOnce({ ok: false, json: async () => ({}) }))

    const seededFromEmptySlo = await getSloResults()
    expect(seededFromEmptySlo.length).toBeGreaterThan(0)

    const seededFromEmptyHealth = await getProviderHealthList()
    expect(seededFromEmptyHealth.length).toBeGreaterThan(0)

    const seededFromMissingHealthObject = await getProviderHealthDetail('resend')
    expect(seededFromMissingHealthObject.health.status).toBe('down')

    const seededFromNotOkDetail = await getProviderHealthDetail('resend')
    expect(seededFromNotOkDetail.health.status).toBe('down')

    delete process.env.NEXT_PUBLIC_APP_URL
    expect((await getSloResults()).length).toBeGreaterThan(0)
    expect((await getProviderHealthList()).length).toBeGreaterThan(0)
  })

  it('calculates cost dashboard from API rollups and falls back to seeded history/ops score', async () => {
    delete process.env.NEXT_PUBLIC_APP_URL
    const seededCost = await getCostDashboardData()
    expect(seededCost.dailyTrend.length).toBe(30)

    process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3001'
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({
        rollups: [
          { day: '2026-06-01', totalEstCostUsd: 10, eventCount: 100, appId: 'web', category: 'compute' },
          { day: '2026-06-01', totalEstCostUsd: 20, eventCount: 200, appId: 'console', category: 'db' },
          { day: '2026-06-02', totalEstCostUsd: 15, eventCount: 150, appId: 'web', category: 'compute' },
        ],
      }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ history: [{ date: '2026-06-01', score: 88, grade: 'B' }] }) }))

    const cost = await getCostDashboardData()
    expect(cost.dailyTrend).toEqual([
      { day: '2026-06-01', totalEstCostUsd: 30 },
      { day: '2026-06-02', totalEstCostUsd: 15 },
    ])
    expect(cost.totalSpend).toBe(45)
    expect(cost.costPerRequest).toBe(0.1)
    expect(cost.topDrivers.length).toBeGreaterThan(0)

    await expect(getOpsScoreHistory(82, 'B')).resolves.toEqual([{ date: '2026-06-01', score: 88, grade: 'B' }])

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, json: async () => ({}) }))
    const fallbackCost = await getCostDashboardData()
    expect(fallbackCost.dailyTrend.length).toBe(30)

    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('ops down') }))
    const seededOps = await getOpsScoreHistory(82, 'B')
    expect(seededOps).toHaveLength(7)

    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ rollups: [] }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ history: [] }) })
      .mockResolvedValueOnce({ ok: false, json: async () => ({}) }))

    const seededFromEmptyRollups = await getCostDashboardData()
    expect(seededFromEmptyRollups.dailyTrend.length).toBe(30)

    const seededFromEmptyHistory = await getOpsScoreHistory(82, 'B')
    expect(seededFromEmptyHistory).toHaveLength(7)

    const seededFromNonOkHistory = await getOpsScoreHistory(82, 'B')
    expect(seededFromNonOkHistory).toHaveLength(7)

    delete process.env.NEXT_PUBLIC_APP_URL
    const noBaseOpsA = await getOpsScoreHistory(95, 'A')
    const noBaseOpsD = await getOpsScoreHistory(61, 'D')
    const noBaseOpsF = await getOpsScoreHistory(2, 'F')
    expect(noBaseOpsA.some((entry) => entry.grade === 'A')).toBe(true)
    expect(noBaseOpsD.some((entry) => entry.grade === 'D')).toBe(true)
    expect(noBaseOpsF.some((entry) => entry.grade === 'F')).toBe(true)

    process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3001'
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({
        rollups: [
          { day: '2026-06-03', totalEstCostUsd: 350, eventCount: 10, appId: 'web', category: 'compute' },
        ],
      }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({
        rollups: [
          { day: '2026-06-04', totalEstCostUsd: 401, eventCount: 10, appId: 'web', category: 'compute' },
        ],
      }) }))

    const warningCost = await getCostDashboardData()
    expect(warningCost.budgetState).toBe('warning')

    const exceededCost = await getCostDashboardData()
    expect(exceededCost.budgetState).toBe('exceeded')
  })

  it('covers alternate status mapping branches for provider rows', async () => {
    process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3001'
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          providers: [
            {
              provider: 'hubspot',
              status: 'degraded',
              lastCheckedAt: '2026-01-01T00:00:00.000Z',
              consecutiveFailures: 0,
            },
          ],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          providers: [
            {
              provider: 'resend',
              status: 'down',
              successRate: 0.8,
              avgLatencyMs: 456,
              circuitState: 'closed',
              consecutiveFailures: 0,
              lastCheckedAt: 'now',
            },
          ],
        }),
      }))

    const providers = await getIntegrationProviders()
    expect(providers[0].status).toBe('degraded')
    expect(providers[0].webhookVerified).toBe(true)

    const health = await getProviderHealthList()
    expect(health[0].status).toBe('down')
    expect(health[0].circuitState).toBe('closed')

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        providers: [
          {
            provider: 'resend',
            status: 'unknown',
            successRate: 0.5,
            avgLatencyMs: 222,
            circuitState: 'open',
            consecutiveFailures: 1,
            lastCheckedAt: 'now',
          },
        ],
      }),
    }))

    const unknownHealth = await getProviderHealthList()
    expect(unknownHealth[0].status).toBe('down')
  })

  it('covers seeded budget and score-grade branch combinations', async () => {
    delete process.env.NEXT_PUBLIC_APP_URL

    const roundSpy = vi.spyOn(Math, 'round')
    roundSpy.mockImplementation((value: number) => {
      if (value > 800 && value < 2500) return 1100
      return Number.parseInt(String(value), 10)
    })

    const warningSeed = await getCostDashboardData()
    expect(warningSeed.budgetState).toBe('warning')

    roundSpy.mockImplementation((value: number) => {
      if (value > 800 && value < 2500) return 1000
      return Number.parseInt(String(value), 10)
    })
    const okSeed = await getCostDashboardData()
    expect(okSeed.budgetState).toBe('ok')
    roundSpy.mockRestore()

    const cGrade = await getOpsScoreHistory(72, 'C')
    expect(cGrade.some((entry) => entry.grade === 'C')).toBe(true)
  })
})
