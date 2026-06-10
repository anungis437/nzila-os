import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  checkDb: vi.fn().mockResolvedValue(true),
  checkBlob: vi.fn().mockResolvedValue(true),
}))

vi.mock('@nzila/db', () => ({
  db: { execute: mocks.checkDb },
}))

vi.mock('drizzle-orm', () => ({
  sql: (strs: TemplateStringsArray) => strs[0],
}))

vi.mock('@nzila/blob', () => ({
  container: () => ({ getProperties: mocks.checkBlob }),
}))

describe('GET /api/health', () => {
  beforeEach(() => {
    vi.resetModules()
    mocks.checkDb.mockResolvedValue(true)
    mocks.checkBlob.mockResolvedValue(true)
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('returns ok when db and blob are healthy', async () => {
    const { GET } = await import('./route')
    const response = await GET()
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.status).toBe('ok')
    expect(body.checks.db).toBe('ok')
    expect(body.checks.blob).toBe('ok')
    expect(body.checks.process).toBe('ok')
  })

  it('returns degraded when db check fails', async () => {
    mocks.checkDb.mockRejectedValue(new Error('db connection failed'))

    const { GET } = await import('./route')
    const response = await GET()
    const body = await response.json()

    expect(response.status).toBe(503)
    expect(body.checks.db).toBe('fail')
    expect(body.checks.blob).toBe('ok')
  })

  it('returns degraded when blob check fails', async () => {
    mocks.checkBlob.mockRejectedValue(new Error('blob unavailable'))

    const { GET } = await import('./route')
    const response = await GET()
    const body = await response.json()

    expect(response.status).toBe(503)
    expect(body.checks.db).toBe('ok')
    expect(body.checks.blob).toBe('fail')
  })

  it('returns degraded when both db and blob fail', async () => {
    mocks.checkDb.mockRejectedValue(new Error('db failed'))
    mocks.checkBlob.mockRejectedValue(new Error('blob failed'))

    const { GET } = await import('./route')
    const response = await GET()
    const body = await response.json()

    expect(response.status).toBe(503)
    expect(body.checks.db).toBe('fail')
    expect(body.checks.blob).toBe('fail')
  })

  it('includes build metadata in response', async () => {
    const { GET } = await import('./route')
    const response = await GET()
    const body = await response.json()

    expect(body.buildInfo).toBeDefined()
    expect(body.app).toBe('console')
  })
})
