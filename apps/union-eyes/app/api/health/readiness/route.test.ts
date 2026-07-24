import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'

// Mock @nzila/db + drizzle-orm before importing the route
const mockExecute = vi.fn()
vi.mock('@nzila/db', () => ({ db: { execute: mockExecute } }))
vi.mock('drizzle-orm', () => ({
  sql: Object.assign((strings: TemplateStringsArray, ..._values: unknown[]) => strings.join(''), {
    raw: (s: string) => s,
  }),
}))

describe('Phase 0C.1 §6 + Phase 0C.2 §6 — /api/health/readiness', () => {
  let originalNodeEnv: string | undefined
  let originalManagedFlag: string | undefined
  let originalRunId: string | undefined

  beforeEach(() => {
    mockExecute.mockReset()
    vi.resetModules()
    originalNodeEnv = process.env.NODE_ENV
    originalManagedFlag = process.env.NZILA_E2E_MANAGED_SERVER
    originalRunId = process.env.NZILA_E2E_RUN_ID
    process.env.NODE_ENV = 'test'
    delete process.env.NZILA_E2E_MANAGED_SERVER
    delete process.env.NZILA_E2E_RUN_ID
  })
  afterEach(() => {
    if (originalNodeEnv === undefined) delete process.env.NODE_ENV
    else process.env.NODE_ENV = originalNodeEnv
    if (originalManagedFlag === undefined) delete process.env.NZILA_E2E_MANAGED_SERVER
    else process.env.NZILA_E2E_MANAGED_SERVER = originalManagedFlag
    if (originalRunId === undefined) delete process.env.NZILA_E2E_RUN_ID
    else process.env.NZILA_E2E_RUN_ID = originalRunId
  })

  /**
   * Green mock: returns healthy responses for every query the route emits.
   * Ordered from most-specific to least-specific so partial substring
   * matches don't shadow more-specific ones.
   */
  function everyTableExists(): void {
    mockExecute.mockImplementation((q: unknown) => {
      const s = String(q)
      // SELECT 1 (connect)
      if (s.trim() === 'SELECT 1') return Promise.resolve([{ '?column?': 1 }])
      // information_schema.tables (schema/table existence probes)
      if (s.includes('information_schema.tables')) return Promise.resolve([{ '1': 1 }])
      // organizations by id (check 11 — fixtures.orgs) — MUST come before
      // any generic `public.` catch-all
      if (s.includes('public.organizations WHERE id')) return Promise.resolve([{ '1': 1 }])
      // user_management.users lookup (check 10 — auth.fixtures)
      if (s.includes('user_management.users WHERE email =')) return Promise.resolve([{ '1': 1 }])
      // user_management.organization_users count (check 12 — fixtures.mappings)
      if (s.includes('user_management.organization_users')) return Promise.resolve([{ c: 10 }])
      // public.organization_members count (check 13 — fixtures.memberships)
      if (s.includes('public.organization_members')) return Promise.resolve([{ c: 10 }])
      // drizzle migrations (checks 5 + 14)
      if (s.includes('__drizzle_migrations')) return Promise.resolve([{ c: 42 }])
      // seed marker (check 9)
      if (s.includes('users WHERE email LIKE')) return Promise.resolve([{ c: 5 }])
      return Promise.resolve([])
    })
  }

  describe('happy path', () => {
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
      expect(body.checks.find((c: any) => c.id === 'db.fixtures.orgs').state).toBe('ok')
      expect(body.checks.find((c: any) => c.id === 'db.fixtures.mappings').state).toBe('ok')
      expect(body.checks.find((c: any) => c.id === 'db.fixtures.memberships').state).toBe('ok')
      expect(body.checks.find((c: any) => c.id === 'db.migration.lineage').state).toBe('ok')
    })

    it('includes exactly 15 check ids', async () => {
      everyTableExists()
      const { GET } = await import('./route')
      const res = await GET()
      const body = await res.json()
      const ids = body.checks.map((c: any) => c.id)
      expect(ids).toEqual([
        'app.boot',
        'db.connect',
        'db.schema.public',
        'db.schema.union_eyes',
        'db.migrations.platform',
        'db.migrations.django',
        'db.contract.phase0b',
        'db.tables.kpi',
        'db.seed.marker',
        'auth.fixtures',
        'db.fixtures.orgs',
        'db.fixtures.mappings',
        'db.fixtures.memberships',
        'db.migration.lineage',
        'env.run_id',
      ])
    })
  })

  describe('database failure modes', () => {
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
        if (s.includes('public.organizations WHERE id')) return Promise.resolve([{ '1': 1 }])
        if (s.includes('user_management.users WHERE email =')) return Promise.resolve([])
        if (s.includes('user_management.organization_users')) return Promise.resolve([{ c: 10 }])
        if (s.includes('public.organization_members')) return Promise.resolve([{ c: 10 }])
        if (s.includes('__drizzle_migrations')) return Promise.resolve([{ c: 42 }])
        if (s.includes('users WHERE email LIKE')) return Promise.resolve([{ c: 0 }])
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
        if (s.includes('public.organizations WHERE id')) return Promise.resolve([{ '1': 1 }])
        if (s.includes('user_management.users WHERE email =')) return Promise.resolve([{ '1': 1 }])
        if (s.includes('user_management.organization_users')) return Promise.resolve([{ c: 10 }])
        if (s.includes('public.organization_members')) return Promise.resolve([{ c: 10 }])
        if (s.includes('__drizzle_migrations')) return Promise.resolve([{ c: 0 }])
        if (s.includes('users WHERE email LIKE')) return Promise.resolve([{ c: 5 }])
        return Promise.resolve([])
      })
      const { GET } = await import('./route')
      const res = await GET()
      expect(res.status).toBe(503)
      const body = await res.json()
      // db.migrations.platform ranks before db.migration.lineage in classifier
      expect(body.status).toBe('migration_pending')
    })
  })

  describe('Phase 0C.2 §6 — fixture completeness', () => {
    it('returns 503 fixtures_incomplete when a fixture org is missing', async () => {
      let orgProbeCount = 0
      mockExecute.mockImplementation((q: unknown) => {
        const s = String(q)
        if (s.trim() === 'SELECT 1') return Promise.resolve([{ '?column?': 1 }])
        if (s.includes('information_schema.tables')) return Promise.resolve([{ '1': 1 }])
        if (s.includes('public.organizations WHERE id')) {
          orgProbeCount += 1
          // First 2 orgs found, third missing
          return Promise.resolve(orgProbeCount < 3 ? [{ '1': 1 }] : [])
        }
        if (s.includes('user_management.users WHERE email =')) return Promise.resolve([{ '1': 1 }])
        if (s.includes('user_management.organization_users')) return Promise.resolve([{ c: 10 }])
        if (s.includes('public.organization_members')) return Promise.resolve([{ c: 10 }])
        if (s.includes('__drizzle_migrations')) return Promise.resolve([{ c: 42 }])
        if (s.includes('users WHERE email LIKE')) return Promise.resolve([{ c: 5 }])
        return Promise.resolve([])
      })
      const { GET } = await import('./route')
      const res = await GET()
      expect(res.status).toBe(503)
      const body = await res.json()
      expect(body.status).toBe('fixtures_incomplete')
      const orgs = body.checks.find((c: any) => c.id === 'db.fixtures.orgs')
      expect(orgs.state).toBe('fail')
      expect(orgs.detail).toMatch(/missing: 1\/3/)
    })

    it('returns 503 fixtures_incomplete when platform mappings are short', async () => {
      mockExecute.mockImplementation((q: unknown) => {
        const s = String(q)
        if (s.trim() === 'SELECT 1') return Promise.resolve([{ '?column?': 1 }])
        if (s.includes('information_schema.tables')) return Promise.resolve([{ '1': 1 }])
        if (s.includes('public.organizations WHERE id')) return Promise.resolve([{ '1': 1 }])
        if (s.includes('user_management.users WHERE email =')) return Promise.resolve([{ '1': 1 }])
        if (s.includes('user_management.organization_users')) return Promise.resolve([{ c: 2 }]) // ← short
        if (s.includes('public.organization_members')) return Promise.resolve([{ c: 10 }])
        if (s.includes('__drizzle_migrations')) return Promise.resolve([{ c: 42 }])
        if (s.includes('users WHERE email LIKE')) return Promise.resolve([{ c: 5 }])
        return Promise.resolve([])
      })
      const { GET } = await import('./route')
      const res = await GET()
      expect(res.status).toBe(503)
      const body = await res.json()
      expect(body.status).toBe('fixtures_incomplete')
      const mappings = body.checks.find((c: any) => c.id === 'db.fixtures.mappings')
      expect(mappings.state).toBe('fail')
      expect(mappings.detail).toMatch(/expected≥5.*found 2/)
    })

    it('returns 503 fixtures_incomplete when memberships are short', async () => {
      mockExecute.mockImplementation((q: unknown) => {
        const s = String(q)
        if (s.trim() === 'SELECT 1') return Promise.resolve([{ '?column?': 1 }])
        if (s.includes('information_schema.tables')) return Promise.resolve([{ '1': 1 }])
        if (s.includes('public.organizations WHERE id')) return Promise.resolve([{ '1': 1 }])
        if (s.includes('user_management.users WHERE email =')) return Promise.resolve([{ '1': 1 }])
        if (s.includes('user_management.organization_users')) return Promise.resolve([{ c: 10 }])
        if (s.includes('public.organization_members')) return Promise.resolve([{ c: 0 }]) // ← empty
        if (s.includes('__drizzle_migrations')) return Promise.resolve([{ c: 42 }])
        if (s.includes('users WHERE email LIKE')) return Promise.resolve([{ c: 5 }])
        return Promise.resolve([])
      })
      const { GET } = await import('./route')
      const res = await GET()
      expect(res.status).toBe(503)
      const body = await res.json()
      expect(body.status).toBe('fixtures_incomplete')
      const memberships = body.checks.find((c: any) => c.id === 'db.fixtures.memberships')
      expect(memberships.state).toBe('fail')
      expect(memberships.detail).toMatch(/expected≥5.*found 0/)
    })
  })

  describe('Phase 0C.2 §6 — migration lineage', () => {
    it('returns 503 migration_pending (not lineage) when 0 migrations applied', async () => {
      // 0 migrations → both platform AND lineage checks fail; classifier picks
      // migration_pending first (higher-priority classifier branch).
      mockExecute.mockImplementation((q: unknown) => {
        const s = String(q)
        if (s.trim() === 'SELECT 1') return Promise.resolve([{ '?column?': 1 }])
        if (s.includes('information_schema.tables')) return Promise.resolve([{ '1': 1 }])
        if (s.includes('public.organizations WHERE id')) return Promise.resolve([{ '1': 1 }])
        if (s.includes('user_management.users WHERE email =')) return Promise.resolve([{ '1': 1 }])
        if (s.includes('user_management.organization_users')) return Promise.resolve([{ c: 10 }])
        if (s.includes('public.organization_members')) return Promise.resolve([{ c: 10 }])
        if (s.includes('__drizzle_migrations')) return Promise.resolve([{ c: 0 }])
        if (s.includes('users WHERE email LIKE')) return Promise.resolve([{ c: 5 }])
        return Promise.resolve([])
      })
      const { GET } = await import('./route')
      const res = await GET()
      expect(res.status).toBe(503)
      const body = await res.json()
      expect(body.status).toBe('migration_pending')
      expect(body.checks.find((c: any) => c.id === 'db.migration.lineage').state).toBe('fail')
    })

    it('reports lineage OK when at the floor exactly (4)', async () => {
      mockExecute.mockImplementation((q: unknown) => {
        const s = String(q)
        if (s.trim() === 'SELECT 1') return Promise.resolve([{ '?column?': 1 }])
        if (s.includes('information_schema.tables')) return Promise.resolve([{ '1': 1 }])
        if (s.includes('public.organizations WHERE id')) return Promise.resolve([{ '1': 1 }])
        if (s.includes('user_management.users WHERE email =')) return Promise.resolve([{ '1': 1 }])
        if (s.includes('user_management.organization_users')) return Promise.resolve([{ c: 10 }])
        if (s.includes('public.organization_members')) return Promise.resolve([{ c: 10 }])
        if (s.includes('__drizzle_migrations')) return Promise.resolve([{ c: 4 }])
        if (s.includes('users WHERE email LIKE')) return Promise.resolve([{ c: 5 }])
        return Promise.resolve([])
      })
      const { GET } = await import('./route')
      const res = await GET()
      expect(res.status).toBe(200)
      const body = await res.json()
      const lineage = body.checks.find((c: any) => c.id === 'db.migration.lineage')
      expect(lineage.state).toBe('ok')
      expect(lineage.detail).toMatch(/applied=4.*floor=4/)
    })
  })

  describe('Phase 0C.2 §6 — env.run_id gate', () => {
    it('is skipped when managed-server flag is not "true"', async () => {
      // env vars deleted in beforeEach
      everyTableExists()
      const { GET } = await import('./route')
      const res = await GET()
      expect(res.status).toBe(200)
      const body = await res.json()
      const runIdCheck = body.checks.find((c: any) => c.id === 'env.run_id')
      expect(runIdCheck.state).toBe('skipped')
      expect(runIdCheck.detail).toMatch(/not in managed-server mode/)
    })

    it('fails when managed-server flag is on but NZILA_E2E_RUN_ID is missing', async () => {
      process.env.NZILA_E2E_MANAGED_SERVER = 'true'
      // NZILA_E2E_RUN_ID left unset
      everyTableExists()
      const { GET } = await import('./route')
      const res = await GET()
      expect(res.status).toBe(503)
      const body = await res.json()
      expect(body.status).toBe('run_id_missing')
      const runIdCheck = body.checks.find((c: any) => c.id === 'env.run_id')
      expect(runIdCheck.state).toBe('fail')
      expect(runIdCheck.detail).toMatch(/NZILA_E2E_RUN_ID required/)
    })

    it('passes with runIdLen detail when both env vars are set', async () => {
      process.env.NZILA_E2E_MANAGED_SERVER = 'true'
      process.env.NZILA_E2E_RUN_ID = 'phase-0c2-run-abc123'
      everyTableExists()
      const { GET } = await import('./route')
      const res = await GET()
      expect(res.status).toBe(200)
      const body = await res.json()
      const runIdCheck = body.checks.find((c: any) => c.id === 'env.run_id')
      expect(runIdCheck.state).toBe('ok')
      expect(runIdCheck.detail).toBe('runIdLen=20')
    })

    it('rejects managed flag values other than exact "true"', async () => {
      // The check gates on process.env[MANAGED_SERVER_ENV] === 'true'
      // — anything else (including "TRUE", "1") is treated as "off"
      process.env.NZILA_E2E_MANAGED_SERVER = 'TRUE'
      everyTableExists()
      const { GET } = await import('./route')
      const res = await GET()
      const body = await res.json()
      const runIdCheck = body.checks.find((c: any) => c.id === 'env.run_id')
      expect(runIdCheck.state).toBe('skipped')
    })
  })

  describe('production redaction', () => {
    it('redacts detail in production', async () => {
      // Force a fail path
      mockExecute.mockImplementation((q: unknown) => {
        const s = String(q)
        if (s.trim() === 'SELECT 1')
          return Promise.reject(new Error('connection to localhost:5433 refused'))
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

  describe('Phase 0C.2 §11 (fix d) — schema probes target user_management.users', () => {
    it('db.seed.marker queries user_management.users (not public.users)', async () => {
      const queries: string[] = []
      mockExecute.mockImplementation((q: unknown) => {
        const s = String(q)
        queries.push(s)
        if (s.trim() === 'SELECT 1') return Promise.resolve([{ '?column?': 1 }])
        if (s.includes('information_schema.tables')) return Promise.resolve([{ '1': 1 }])
        if (s.includes('public.organizations WHERE id')) return Promise.resolve([{ '1': 1 }])
        if (s.includes('user_management.users WHERE email =')) return Promise.resolve([{ '1': 1 }])
        if (s.includes('user_management.organization_users')) return Promise.resolve([{ c: 10 }])
        if (s.includes('public.organization_members')) return Promise.resolve([{ c: 10 }])
        if (s.includes('__drizzle_migrations')) return Promise.resolve([{ c: 42 }])
        if (s.includes('users WHERE email LIKE')) return Promise.resolve([{ c: 5 }])
        return Promise.resolve([])
      })
      const { GET } = await import('./route')
      const res = await GET()
      expect(res.status).toBe(200)
      // Any query that filters by LIKE (the seed-marker probe) MUST be
      // aimed at user_management.users — never public.users.
      const likeQueries = queries.filter((q) => q.includes('WHERE email LIKE'))
      expect(likeQueries.length).toBeGreaterThan(0)
      for (const q of likeQueries) {
        expect(q).toContain('user_management.users')
        expect(q).not.toMatch(/\bpublic\.users\b/)
      }
    })

    it('db.schema.public does NOT require a public.users table', async () => {
      // Every information_schema.tables probe returns exists=false EXCEPT
      // for `public.organizations`. If the endpoint still required
      // `public.users`, this scenario would produce db.schema.public=fail
      // and status=schema_missing (as it did before fix d).
      mockExecute.mockImplementation((q: unknown) => {
        const s = String(q)
        if (s.trim() === 'SELECT 1') return Promise.resolve([{ '?column?': 1 }])
        if (s.includes('information_schema.tables')) {
          const isOrgs =
            s.includes("table_schema = 'public'") && s.includes("table_name = 'organizations'")
          const isOrgMembers =
            s.includes("table_schema = 'public'") &&
            s.includes("table_name = 'organization_members'")
          return Promise.resolve(isOrgs || isOrgMembers ? [{ '1': 1 }] : [])
        }
        if (s.includes('public.organizations WHERE id')) return Promise.resolve([{ '1': 1 }])
        if (s.includes('user_management.users WHERE email =')) return Promise.resolve([{ '1': 1 }])
        if (s.includes('user_management.organization_users')) return Promise.resolve([{ c: 10 }])
        if (s.includes('public.organization_members')) return Promise.resolve([{ c: 10 }])
        if (s.includes('__drizzle_migrations')) return Promise.resolve([{ c: 42 }])
        if (s.includes('users WHERE email LIKE')) return Promise.resolve([{ c: 5 }])
        return Promise.resolve([])
      })
      const { GET } = await import('./route')
      const res = await GET()
      const body = await res.json()
      const schemaPublic = body.checks.find((c: any) => c.id === 'db.schema.public')
      expect(schemaPublic.state).toBe('ok')
      // The earlier bug produced `db.schema.public: fail, detail: missing: users`.
      // Assert that specific failure mode is gone regardless of other checks'
      // status.
      expect(schemaPublic.detail ?? '').not.toMatch(/missing:[^,]*\busers\b/)
    })
  })
})
