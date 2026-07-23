import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { assertNotProductionUrl } from './env'

// These tests validate defensive behavior WITHOUT talking to postgres.
// Live integration is exercised by the governed lifecycle itself and
// captured in reports/audits/cupe-national-phase-0/phase-0c/phase-0c-database-fixture-proof.md.

describe('Phase 0C.1 §7 — disposable database allocator (contract-only)', () => {
  const snapshot: Record<string, string | undefined> = {}
  const keys = ['NODE_ENV', 'E2E_DB_ADMIN_URL', 'QA_TEST_ENV_ALLOW_PROD_URL', 'E2E_PRESERVE_DB']

  beforeEach(() => {
    for (const k of keys) {
      snapshot[k] = process.env[k]
      delete process.env[k]
    }
  })

  afterEach(() => {
    for (const [k, v] of Object.entries(snapshot)) {
      if (v === undefined) delete process.env[k]
      else process.env[k] = v
    }
    vi.resetModules()
  })

  it('refuses production NODE_ENV', async () => {
    process.env.NODE_ENV = 'production'
    process.env.E2E_DB_ADMIN_URL = 'postgres://nzila:nzila_dev@localhost:5433/postgres'
    const mod = await import('./allocate-db')
    await expect(mod.allocateDatabase({ skipMigrations: true })).rejects.toThrow(
      /NODE_ENV=production/,
    )
  })

  it('refuses production-shaped admin URL', async () => {
    process.env.NODE_ENV = 'test'
    process.env.E2E_DB_ADMIN_URL = 'postgres://u:p@nzila-prod-db.postgres.database.azure.com:5432/postgres'
    const mod = await import('./allocate-db')
    await expect(mod.allocateDatabase({ skipMigrations: true })).rejects.toThrow(
      /appears production-shaped/,
    )
  })

  it('assertNotProductionUrl allows canonical local URL', () => {
    expect(() =>
      assertNotProductionUrl('postgres://nzila:nzila_dev@localhost:5433/postgres', false),
    ).not.toThrow()
  })
})
