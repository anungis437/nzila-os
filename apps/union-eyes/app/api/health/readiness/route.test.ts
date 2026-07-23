import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'

// Mock @nzila/db + drizzle-orm before importing the route
const mockExecute = vi.fn()
vi.mock('@nzila/db', () => ({ db: { execute: mockExecute } }))
vi.mock('drizzle-orm', () => ({
  sql: Object.assign((strings: TemplateStringsArray, ..._values: unknown[]) => strings.join(''), {
    raw: (s: string) => s,
  }),
}))

describe('Phase 0C.1 §6 — /api/health/readiness', () => {
  let originalNodeEnv: string | undefined
  beforeEach(() => {
    mockExecute.mockReset()
    originalNodeEnv = process.env.NODE_ENV
    process.env.NODE_ENV = 'test'
  })
  afterEach(() => {
    if (originalNodeEnv === undefined) delete process.env.NODE_ENV
    else process.env.NODE_ENV = originalNodeEnv
  })

  function everyTableExists(): void {
    mockExecute.mockImplementation((q: unknown) => {
      const s = String(q)
      // SELECT 1 (connect)
      if (s.trim() === 'SELECT 1') return Promise.resolve([{ '?column?': 1 }])
      // information_schema.tables
      if (s.includes('information_schema.tables')) return Promise.resolve([{ '1': 1 }])
      // drizzle migrations
      if (s.includes('__drizzle_migrations')) return Promise.resolve([{ c: 42 }])
      // fixture user count
      if (s.includes('users WHERE email LIKE')) return Promise.resolve([{ c: 5 }])
      // auth_users lookup
      if (s.includes('user_management.users WHERE email')) return Promise.resolve([{ '1': 1 }])
      return Promise.resolve([])
    })
  }

  it('returns 200 ready when all critical checks pass', async () => {
    everyTableExists()
    const { GET } = await import('./route')
    const res = await GET()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.status).toBe('ready')
    expect(body.checks.find((c: any) => c.id === 'app.boot').state).toBe('ok')
    expect(body.checks.find((c: any) => c.id === 'db.connect').state).toBe('ok')
    expect(body.checks.find((c: any) => c.id === 'db.seed.marker').state).toBe('ok')
    expect(body.checks.find((c: any) => c.id === 'auth.fixtures').state).toBe('ok')
  })

  it('returns 503 database_unavailable when SELECT 1 fails', async () => {
    mockExecute.mockImplementation((q: unknown) => {
      const s = String(q)
      if (s.trim() === 'SELECT 1') return Promise.reject(new Error('ECONNREFUSED'))
      return Promise.resolve([])
    })
    const { GET } = await import('./route')
    const res = await GET()
    expect(res.status).toBe(503)
    const body = await res.json()
    expect(body.status).toBe('database_unavailable')
  })

  it('returns 503 seed_missing when no fixture users exist', async () => {
    mockExecute.mockImplementation((q: unknown) => {
      const s = String(q)
      if (s.trim() === 'SELECT 1') return Promise.resolve([{ '?column?': 1 }])
      if (s.includes('information_schema.tables')) return Promise.resolve([{ '1': 1 }])
      if (s.includes('__drizzle_migrations')) return Promise.resolve([{ c: 42 }])
      if (s.includes('users WHERE email LIKE')) return Promise.resolve([{ c: 0 }])
      if (s.includes('user_management.users WHERE email')) return Promise.resolve([])
      return Promise.resolve([])
    })
    const { GET } = await import('./route')
    const res = await GET()
    expect(res.status).toBe(503)
    const body = await res.json()
    expect(body.status).toBe('seed_missing')
    expect(
      body.checks.find((c: any) => c.id === 'db.seed.marker').detail,
    ).toMatch(/expected/)
  })

  it('returns 503 migration_pending when no migrations applied', async () => {
    mockExecute.mockImplementation((q: unknown) => {
      const s = String(q)
      if (s.trim() === 'SELECT 1') return Promise.resolve([{ '?column?': 1 }])
      if (s.includes('information_schema.tables')) return Promise.resolve([{ '1': 1 }])
      if (s.includes('__drizzle_migrations')) return Promise.resolve([{ c: 0 }])
      if (s.includes('users WHERE email LIKE')) return Promise.resolve([{ c: 5 }])
      if (s.includes('user_management.users WHERE email')) return Promise.resolve([{ '1': 1 }])
      return Promise.resolve([])
    })
    const { GET } = await import('./route')
    const res = await GET()
    expect(res.status).toBe(503)
    const body = await res.json()
    expect(body.status).toBe('migration_pending')
  })

  it('redacts detail in production', async () => {
    everyTableExists()
    // Force a fail path
    mockExecute.mockImplementation((q: unknown) => {
      const s = String(q)
      if (s.trim() === 'SELECT 1') return Promise.reject(new Error('connection to localhost:5433 refused'))
      return Promise.resolve([])
    })
    process.env.NODE_ENV = 'production'
    vi.resetModules()
    const { GET } = await import('./route')
    const res = await GET()
    const body = await res.json()
    for (const check of body.checks) {
      expect(check).not.toHaveProperty('detail')
    }
  })
})
