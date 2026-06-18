import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  dbFail: false,
  blobFail: false,
  redisFail: false,
}))

vi.mock('@nzila/db', () => ({
  db: {
    execute: async () => {
      if (mocks.dbFail) throw new Error('db failed')
      return true
    },
  },
}))

vi.mock('drizzle-orm', () => ({
  sql: (strs: TemplateStringsArray) => strs[0],
}))

vi.mock('@nzila/blob', () => ({
  container: (_name: string) => {
    if (mocks.blobFail) throw new Error('blob failed')
    return { getProperties: async () => ({}) }
  },
}))

vi.mock('@nzila/os-core/rateLimit/store', () => ({
  getRateLimitStore: async () => {
    if (mocks.redisFail) throw new Error('redis failed')
    return { hit: async () => true }
  },
}))

describe('GET /api/health', () => {
  beforeEach(() => {
    mocks.dbFail = false
    mocks.blobFail = false
    mocks.redisFail = false
  })

  it('returns ok when all checks pass', async () => {
    const { GET } = await import('./route')
    const response = await GET()
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.status).toBe('ok')
    expect(body.app).toBe('@nzila/zonga')
    expect(body.checks).toBeDefined()
    expect(body.checks.db).toBe(true)
  })

  it('returns degraded when db check fails', async () => {
    mocks.dbFail = true

    const { GET } = await import('./route')
    const response = await GET()
    const body = await response.json()

    expect(response.status).toBe(503)
    expect(body.status).toBe('degraded')
    expect(body.checks.db).toBe(false)
  })

  it('returns degraded when blob check fails', async () => {
    mocks.blobFail = true

    const { GET } = await import('./route')
    const response = await GET()
    const body = await response.json()

    expect(response.status).toBe(503)
    expect(body.status).toBe('degraded')
    expect(body.checks.blob).toBe(false)
  })

  it('includes build metadata', async () => {
    const { GET } = await import('./route')
    const response = await GET()
    const body = await response.json()

    expect(body).toHaveProperty('buildInfo')
    expect(body.buildInfo).toHaveProperty('version')
    expect(body.buildInfo).toHaveProperty('commit')
  })
})
