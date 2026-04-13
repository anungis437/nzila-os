import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { MlSdkConfig } from './client'

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

function cfg(overrides: Partial<MlSdkConfig> = {}): MlSdkConfig {
  return {
    baseUrl: 'https://console.nzila.io',
    getToken: () => 'tok-123',
    ...overrides,
  }
}

function jsonRes(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

// dynamic import so vi.stubGlobal('fetch') is in place
async function load() {
  return import('./client')
}

describe('createMlClient', () => {
  beforeEach(() => {
    mockFetch.mockReset()
  })

  it('getAllModels sends correct URL and headers', async () => {
    const { createMlClient } = await load()
    mockFetch.mockResolvedValueOnce(jsonRes([]))
    const client = createMlClient(cfg())
    const result = await client.getAllModels('org-1')
    expect(result).toEqual([])

    const [url, init] = mockFetch.mock.calls[0]!
    expect(url).toContain('/api/ml/models')
    expect(url).toContain('orgId=org-1')
    expect(init.headers.Authorization).toBe('Bearer tok-123')
  })

  it('getAllModels passes status param when provided', async () => {
    const { createMlClient } = await load()
    mockFetch.mockResolvedValueOnce(jsonRes([]))
    const client = createMlClient(cfg())
    await client.getAllModels('org-1', 'active')

    const [url] = mockFetch.mock.calls[0]!
    expect(url).toContain('status=active')
  })

  it('getActiveModels calls correct endpoint', async () => {
    const { createMlClient } = await load()
    mockFetch.mockResolvedValueOnce(jsonRes([]))
    const client = createMlClient(cfg())
    await client.getActiveModels('org-2')

    const [url] = mockFetch.mock.calls[0]!
    expect(url).toContain('/api/ml/models/active')
    expect(url).toContain('orgId=org-2')
  })

  it('getTrainingRuns passes limit param', async () => {
    const { createMlClient } = await load()
    mockFetch.mockResolvedValueOnce(jsonRes([]))
    const client = createMlClient(cfg())
    await client.getTrainingRuns('org-1', 5)

    const [url] = mockFetch.mock.calls[0]!
    expect(url).toContain('limit=5')
  })

  it('getInferenceRuns uses default limit when not provided', async () => {
    const { createMlClient } = await load()
    mockFetch.mockResolvedValueOnce(jsonRes([]))
    const client = createMlClient(cfg())
    await client.getInferenceRuns('org-1')

    const [url] = mockFetch.mock.calls[0]!
    expect(url).toContain('/api/ml/runs/inference')
    expect(url).toContain('limit=20')
  })

  it('getStripeDailyScores sends all params', async () => {
    const { createMlClient } = await load()
    mockFetch.mockResolvedValueOnce(jsonRes([]))
    const client = createMlClient(cfg())
    await client.getStripeDailyScores({
      orgId: 'org-1',
      startDate: '2026-01-01',
      endDate: '2026-01-31',
      includeFeatures: true,
    })

    const [url] = mockFetch.mock.calls[0]!
    expect(url).toContain('startDate=2026-01-01')
    expect(url).toContain('endDate=2026-01-31')
    expect(url).toContain('includeFeatures=true')
  })

  it('omits undefined query params', async () => {
    const { createMlClient } = await load()
    mockFetch.mockResolvedValueOnce(jsonRes([]))
    const client = createMlClient(cfg())
    await client.getAllModels('org-1')

    const [url] = mockFetch.mock.calls[0]!
    expect(url).toContain('orgId=org-1')
    expect(url).not.toContain('status=')
  })

  it('getStripeTxnScores returns paginated payload and endpoint', async () => {
    const { createMlClient } = await load()
    mockFetch.mockResolvedValueOnce(
      jsonRes({ items: [], nextCursor: 'c-1', totalInPeriod: 12, anomalyInPeriod: 3 }),
    )
    const client = createMlClient(cfg())
    const result = await client.getStripeTxnScores({
      orgId: 'org-1',
      startDate: '2026-01-01',
      endDate: '2026-01-31',
      limit: 25,
    })

    const [url] = mockFetch.mock.calls[0]!
    expect(url).toContain('/api/ml/scores/stripe/transactions')
    expect(result.totalInPeriod).toBe(12)
    expect(result.anomalyInPeriod).toBe(3)
    expect(result.nextCursor).toBe('c-1')
  })

  it('throws MlSdkError on non-ok response', async () => {
    const { createMlClient } = await load()
    mockFetch.mockResolvedValueOnce(
      new Response('not found', { status: 404 }),
    )
    const client = createMlClient(cfg())
    await expect(client.getAllModels('org-1')).rejects.toThrow('ML API')
  })

  it('MlSdkError exposes status code', async () => {
    const { createMlClient } = await load()
    mockFetch.mockResolvedValueOnce(
      new Response('forbidden', { status: 403 }),
    )
    const client = createMlClient(cfg())
    try {
      await client.getAllModels('org-1')
      expect.unreachable('should have thrown')
    } catch (err: unknown) {
      const e = err as { code: string; status: number }
      expect(e.code).toBe('API_ERROR')
      expect(e.status).toBe(403)
    }
  })

  it('supports async getToken', async () => {
    const { createMlClient } = await load()
    mockFetch.mockResolvedValueOnce(jsonRes([]))
    const client = createMlClient(
      cfg({ getToken: async () => 'async-tok' }),
    )
    await client.getAllModels('org-1')

    const [, init] = mockFetch.mock.calls[0]!
    expect(init.headers.Authorization).toBe('Bearer async-tok')
  })

  it('getUEPriorityScores calls correct endpoint', async () => {
    const { createMlClient } = await load()
    mockFetch.mockResolvedValueOnce(
      jsonRes({ items: [], nextCursor: null, total: 0 }),
    )
    const client = createMlClient(cfg())
    const res = await client.getUEPriorityScores({
      orgId: 'org-1',
      startDate: '2026-01-01',
      endDate: '2026-01-31',
    })

    const [url] = mockFetch.mock.calls[0]!
    expect(url).toContain('/api/ml/scores/ue/cases/priority')
    expect(res.total).toBe(0)
  })

  it('getUESlaRiskScores calls correct endpoint', async () => {
    const { createMlClient } = await load()
    mockFetch.mockResolvedValueOnce(
      jsonRes({ items: [], nextCursor: null, total: 0 }),
    )
    const client = createMlClient(cfg())
    const res = await client.getUESlaRiskScores({
      orgId: 'org-1',
      startDate: '2026-01-01',
      endDate: '2026-01-31',
    })

    const [url] = mockFetch.mock.calls[0]!
    expect(url).toContain('/api/ml/scores/ue/cases/sla-risk')
    expect(res.total).toBe(0)
  })

  it('exports createMlClient from index barrel', async () => {
    const pkg = await import('./index')
    expect(pkg.createMlClient).toBeTypeOf('function')
  })
})
