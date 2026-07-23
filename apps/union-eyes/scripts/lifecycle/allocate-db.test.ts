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

  // Phase 0C.2 §3 — safe-failure when neither options.adminUrl nor
  // E2E_DB_ADMIN_URL is provided. Previously the allocator silently fell
  // back to a hardcoded literal (nzila:nzila_dev@localhost:5433/postgres),
  // which (a) leaked into the git history and (b) meant callers that
  // forgot to configure the environment would accidentally attach to a
  // developer's local postgres. The fallback is now removed; the
  // allocator must throw with a diagnostic identifying the caller.
  describe('§3 admin-URL required (no hardcoded fallback)', () => {
    it('allocateDatabase throws with a diagnostic when E2E_DB_ADMIN_URL is unset and no options.adminUrl is provided', async () => {
      process.env.NODE_ENV = 'test'
      delete process.env.E2E_DB_ADMIN_URL
      const mod = await import('./allocate-db')
      await expect(mod.allocateDatabase({ skipMigrations: true })).rejects.toThrow(
        /allocateDatabase: E2E_DB_ADMIN_URL is required/,
      )
    })

    it('dropDatabase throws with a diagnostic when E2E_DB_ADMIN_URL is unset and no options.adminUrl is provided', async () => {
      process.env.NODE_ENV = 'test'
      delete process.env.E2E_DB_ADMIN_URL
      const mod = await import('./allocate-db')
      const fakeAllocation = {
        runId: 'x',
        dbName: 'ue_e2e_x_x',
        url: 'postgres://u:p@localhost:5433/ue_e2e_x_x',
        runDir: '/tmp/x',
        preserved: false,
      }
      await expect(mod.dropDatabase(fakeAllocation)).rejects.toThrow(
        /dropDatabase: E2E_DB_ADMIN_URL is required/,
      )
    })

    it('options.adminUrl overrides missing env — no fallback consulted', async () => {
      process.env.NODE_ENV = 'test'
      delete process.env.E2E_DB_ADMIN_URL
      const mod = await import('./allocate-db')
      // Explicit prod-shaped URL should trip the prod-URL guard, proving the
      // option was in fact read (not shadowed by the removed hardcoded fallback).
      await expect(
        mod.allocateDatabase({
          skipMigrations: true,
          adminUrl: 'postgres://u:p@nzila-prod-db.postgres.database.azure.com:5432/postgres',
        }),
      ).rejects.toThrow(/appears production-shaped/)
    })

    it('whitespace-only env value is treated as missing', async () => {
      process.env.NODE_ENV = 'test'
      process.env.E2E_DB_ADMIN_URL = '   '
      const mod = await import('./allocate-db')
      await expect(mod.allocateDatabase({ skipMigrations: true })).rejects.toThrow(
        /allocateDatabase: E2E_DB_ADMIN_URL is required/,
      )
    })
  })
})
