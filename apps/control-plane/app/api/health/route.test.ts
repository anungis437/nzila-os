import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  checkDb: vi.fn().mockResolvedValue(true),
}))

vi.mock('@nzila/db', () => ({
  db: { execute: mocks.checkDb },
}))

vi.mock('drizzle-orm', () => ({
  sql: (strs: TemplateStringsArray) => strs[0],
}))

describe('GET /api/health', () => {
  beforeEach(() => {
    vi.resetModules()
    mocks.checkDb.mockResolvedValue(true)
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('returns ok when db is healthy', async () => {
    const { GET } = await import('./route')
    const response = await GET()
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.status).toBe('ok')
    expect(body.app).toBe('@nzila/control-plane')
    expect(body.checks.db).toBe(true)
    expect(body.buildInfo).toBeDefined()
    expect(body.buildInfo.version).toBeDefined()
    expect(body.buildInfo.commit).toBeDefined()
  })

  it('returns degraded when db check fails', async () => {
    mocks.checkDb.mockRejectedValue(new Error('db connection failed'))

    const { GET } = await import('./route')
    const response = await GET()
    const body = await response.json()

    expect(response.status).toBe(503)
    expect(body.status).toBe('degraded')
    expect(body.checks.db).toBe(false)
  })

  it('includes timestamp in response', async () => {
    const { GET } = await import('./route')
    const response = await GET()
    const body = await response.json()

    expect(body.timestamp).toBeDefined()
    expect(() => new Date(body.timestamp)).not.toThrow()
  })
})
