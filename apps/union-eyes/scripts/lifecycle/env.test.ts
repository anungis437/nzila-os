import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  _resetGovernedE2EEnvCache,
  applyEnvToProcess,
  assertNotProductionUrl,
  loadGovernedE2EEnv,
  redactUrl,
  summarizeGovernedE2EEnv,
} from './env'

const KEYS_TO_CLEAR = [
  'NODE_ENV',
  'QA_TEST_ENV',
  'PLAYWRIGHT_TEST_AUTH',
  'PLAYWRIGHT_BASE_URL',
  'NEXT_PUBLIC_APP_URL',
  'AUTH_SECRET',
  'VOTING_SECRET',
  'DJANGO_SECRET_KEY',
  'NEXTAUTH_SECRET',
  'DATABASE_URL',
  'E2E_DB_ADMIN_URL',
  'UE_E2E_RISK_BYPASS',
  'E2E_PRESERVE_DB',
  'E2E_PORT',
  'QA_TEST_ENV_ALLOW_PROD_URL',
] as const

let snapshot: Record<string, string | undefined> = {}

describe('Phase 0C.1 §5 — governed E2E env loader', () => {
  beforeEach(() => {
    snapshot = {}
    for (const k of KEYS_TO_CLEAR) {
      snapshot[k] = process.env[k]
      delete process.env[k]
    }
    _resetGovernedE2EEnvCache()
  })

  afterEach(() => {
    for (const [k, v] of Object.entries(snapshot)) {
      if (v === undefined) delete process.env[k]
      else process.env[k] = v
    }
    _resetGovernedE2EEnvCache()
  })

  it('provides deterministic test defaults for a bare-minimum env', () => {
    // With appRoot pointing to a directory with no .env files, only defaults apply
    const env = loadGovernedE2EEnv({ appRoot: __dirname })
    expect(env.NODE_ENV).toBe('test')
    expect(env.QA_TEST_ENV).toBe('true')
    expect(env.PLAYWRIGHT_TEST_AUTH).toBe('true')
    expect(env.UE_E2E_RISK_BYPASS).toBe('true')
    expect(env.PLAYWRIGHT_BASE_URL).toMatch(/^http:\/\/localhost:3002$/)
    expect(env.NEXT_PUBLIC_APP_URL).toMatch(/^http:\/\/localhost:3002$/)
    expect(env.AUTH_SECRET.length).toBeGreaterThanOrEqual(16)
    expect(env.VOTING_SECRET.length).toBeGreaterThanOrEqual(16)
    expect(env.DJANGO_SECRET_KEY.length).toBeGreaterThanOrEqual(16)
    expect(env.NEXTAUTH_SECRET.length).toBeGreaterThanOrEqual(16)
    expect(env.E2E_DB_ADMIN_URL).toContain('postgres')
    // DATABASE_URL not required by default
    expect(env.DATABASE_URL).toBe('')
  })

  it('rejects production NODE_ENV', () => {
    process.env.NODE_ENV = 'production'
    expect(() => loadGovernedE2EEnv({ appRoot: __dirname })).toThrow(/NODE_ENV=production/)
  })

  it('rejects production-shaped DATABASE_URL', () => {
    process.env.DATABASE_URL = 'postgresql://user:secret@nzila-prod-db.postgres.database.azure.com:5432/appdb'
    expect(() => loadGovernedE2EEnv({ appRoot: __dirname })).toThrow(
      /appears production-shaped/,
    )
  })

  it('rejects production-shaped E2E_DB_ADMIN_URL', () => {
    process.env.E2E_DB_ADMIN_URL = 'postgresql://user:secret@nzila-prod-writer.postgres.database.azure.com:5432/postgres'
    expect(() => loadGovernedE2EEnv({ appRoot: __dirname })).toThrow(
      /appears production-shaped/,
    )
  })

  it('allows a production-shaped URL only when QA_TEST_ENV_ALLOW_PROD_URL=true', () => {
    process.env.DATABASE_URL = 'postgresql://user:secret@nzila-prod-writer.postgres.database.azure.com:5432/appdb'
    process.env.QA_TEST_ENV_ALLOW_PROD_URL = 'true'
    expect(() => loadGovernedE2EEnv({ appRoot: __dirname })).not.toThrow()
  })

  it('rejects invalid URL for PLAYWRIGHT_BASE_URL', () => {
    process.env.PLAYWRIGHT_BASE_URL = 'not a url'
    expect(() => loadGovernedE2EEnv({ appRoot: __dirname })).toThrow(/Invalid URL/)
  })

  it('rejects short secrets', () => {
    process.env.AUTH_SECRET = 'short'
    expect(() => loadGovernedE2EEnv({ appRoot: __dirname })).toThrow(
      /AUTH_SECRET.*≥ 16/,
    )
  })

  it('rejects invalid E2E_PORT', () => {
    process.env.E2E_PORT = 'not-a-number'
    expect(() => loadGovernedE2EEnv({ appRoot: __dirname })).toThrow(/E2E_PORT/)
  })

  it('requires DATABASE_URL when requireDatabaseUrl=true', () => {
    expect(() => loadGovernedE2EEnv({ appRoot: __dirname, requireDatabaseUrl: true })).toThrow(
      /DATABASE_URL is required/,
    )
  })

  it('assertNotProductionUrl catches every hint', () => {
    for (const hint of ['prod', 'production', 'azure.com', 'rds.amazonaws.com', 'supabase.co']) {
      expect(() => assertNotProductionUrl(`postgres://x:y@${hint}.example/db`, false)).toThrow()
    }
  })

  it('summarize redacts every secret and both DB URLs', () => {
    const env = loadGovernedE2EEnv({ appRoot: __dirname })
    const summary = summarizeGovernedE2EEnv(env)
    expect(summary.AUTH_SECRET).toMatch(/^<redacted:\d+chars>$/)
    expect(summary.VOTING_SECRET).toMatch(/^<redacted:\d+chars>$/)
    expect(summary.DJANGO_SECRET_KEY).toMatch(/^<redacted:\d+chars>$/)
    expect(summary.NEXTAUTH_SECRET).toMatch(/^<redacted:\d+chars>$/)
    expect(summary.E2E_DB_ADMIN_URL).not.toContain('nzila_dev')
    // No raw secret leaks
    for (const value of Object.values(summary)) {
      expect(value).not.toMatch(/phase-0c1-governed/)
    }
  })

  it('redactUrl handles typical postgres URL', () => {
    expect(redactUrl('postgresql://nzila:nzila_dev@localhost:5433/nzila_automation')).toBe(
      'postgresql://<user>:<pw>@localhost:5433/nzila_automation',
    )
  })

  it('applyEnvToProcess populates process.env with all defined keys', () => {
    const env = loadGovernedE2EEnv({ appRoot: __dirname })
    // Clear again so we can prove applyEnvToProcess sets them
    for (const k of KEYS_TO_CLEAR) delete process.env[k]
    applyEnvToProcess(env)
    expect(process.env.NODE_ENV).toBe('test')
    expect(process.env.QA_TEST_ENV).toBe('true')
    expect(process.env.PLAYWRIGHT_BASE_URL).toBe(env.PLAYWRIGHT_BASE_URL)
    expect(process.env.AUTH_SECRET).toBe(env.AUTH_SECRET)
  })

  it('Phase 0C.2 §11 regression — run.ts orchestrator wires applyEnvToProcess after loadGovernedE2EEnv', async () => {
    // Baseline Run 1 (see reports/audits/cupe-national-phase-0/phase-0c/
    // phase-0c2-baseline-run-1.md) aborted at step 6 because run.ts loaded
    // the governed env but never applied it to process.env — spawned children
    // (drizzle bootstrap, seed, next dev) inherited a bare env missing
    // QA_TEST_ENV=true, so the QA baseline SQL was silently skipped and
    // organization_members never existed. This test guards that regression
    // by asserting the source explicitly imports and invokes the helper.
    const fs = await import('node:fs')
    const path = await import('node:path')
    const runSrc = fs.readFileSync(path.join(__dirname, 'run.ts'), 'utf8')
    expect(runSrc).toMatch(/import\s*\{[^}]*\bapplyEnvToProcess\b[^}]*\}\s*from\s*['"]\.\/env['"]/)
    // Must be called after the env is loaded and before the readiness log line.
    const loadIdx = runSrc.indexOf('loadGovernedE2EEnv({ appRoot: APP_ROOT })')
    const applyIdx = runSrc.indexOf('applyEnvToProcess(env)')
    expect(loadIdx).toBeGreaterThan(0)
    expect(applyIdx).toBeGreaterThan(loadIdx)
  })
})
