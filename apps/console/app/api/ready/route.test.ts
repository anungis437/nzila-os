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

describe('GET /api/ready', () => {
  beforeEach(() => {
    vi.resetModules()
    mocks.checkDb.mockResolvedValue(true)
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('returns ready when db is healthy', async () => {
    const { GET } = await import('./route')
    const response = await GET()
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.ready).toBe(true)
    expect(body.status).toBe('ready')
    expect(body.checks.database).toBe('ok')
    expect(body.checks.process).toBe('ok')
  })

  it('returns not_ready when db check fails', async () => {
    mocks.checkDb.mockRejectedValue(new Error('db connection failed'))

    const { GET } = await import('./route')
    const response = await GET()
    const body = await response.json()

    expect(response.status).toBe(503)
    expect(body.ready).toBe(false)
    expect(body.status).toBe('not_ready')
    expect(body.checks.database).toBe('fail')
  })

  it('includes build metadata and required checks', async () => {
    const { GET } = await import('./route')
    const response = await GET()
    const body = await response.json()

    expect(body.app).toBe('console')
    expect(body.checks).toHaveProperty('queue')
    expect(body.checks).toHaveProperty('storage')
    expect(body.checks).toHaveProperty('thirdParty')
  })
})
