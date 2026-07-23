/**
 * Phase 0C.1 §5 — Governed E2E environment loader.
 *
 * Contract:
 *   - Loads and validates every env var the Union Eyes E2E baseline needs.
 *   - Generates deterministic test defaults for non-secret values.
 *   - Refuses production-shaped DATABASE_URL / hostnames.
 *   - Refuses when NODE_ENV is production.
 *   - Never commits or logs secrets; only names are logged.
 *
 * Consumers:
 *   - scripts/lifecycle/allocate-db.ts
 *   - scripts/lifecycle/run.ts
 *   - playwright.config.ts (via getGovernedE2EEnv())
 *
 * NOT used by the Next.js server at runtime — the server reads
 * process.env normally; this loader only ensures the process env is
 * populated correctly BEFORE the server boots.
 */

import fs from 'node:fs'
import path from 'node:path'
import dotenv from 'dotenv'

/** All values required or provisioned by the governed E2E lifecycle. */
export interface GovernedE2EEnv {
  // Node / mode
  NODE_ENV: 'test' | 'development'
  QA_TEST_ENV: 'true'
  PLAYWRIGHT_TEST_AUTH: 'true'
  // Application URLs
  PLAYWRIGHT_BASE_URL: string
  NEXT_PUBLIC_APP_URL: string
  // Secrets (test-only defaults acceptable)
  AUTH_SECRET: string
  VOTING_SECRET: string
  DJANGO_SECRET_KEY: string
  NEXTAUTH_SECRET: string
  // Database
  DATABASE_URL: string
  E2E_DB_ADMIN_URL: string
  // Lifecycle switches
  UE_E2E_RISK_BYPASS: 'true'
  // Optional preservation switches (undefined by default)
  E2E_PRESERVE_DB?: 'true'
  E2E_PORT?: string
}

/** Config for loading — path defaults are computed from module location. */
export interface LoadOptions {
  /** Root of union-eyes app (defaults to two levels above this file). */
  appRoot?: string
  /** If true, also require a real DATABASE_URL up front (default false — allocator will fill it). */
  requireDatabaseUrl?: boolean
  /** When true, allow a production-shaped URL. Never use in normal E2E. */
  allowProdUrl?: boolean
}

const PROD_URL_HINTS = ['prod', 'production', 'azure.com', 'rds.amazonaws.com', 'supabase.co']
const REQUIRED_MIN_SECRET_LENGTH = 16

/**
 * Deterministic test-only defaults. These are safe to commit to git because
 * they are only ever used when QA_TEST_ENV=true AND NODE_ENV=test AND
 * DATABASE_URL is not production-shaped. Production reject-guards prevent
 * accidental use in any real environment.
 */
const DETERMINISTIC_TEST_DEFAULTS = {
  AUTH_SECRET: 'phase-0c1-governed-test-auth-secret-0123456789abcdef',
  VOTING_SECRET: 'phase-0c1-governed-test-voting-secret-0123456789abcdef',
  DJANGO_SECRET_KEY: 'phase-0c1-governed-test-django-secret-0123456789abcdef',
  NEXTAUTH_SECRET: 'phase-0c1-governed-test-nextauth-secret-0123456789abcdef',
  PLAYWRIGHT_BASE_URL: 'http://localhost:3002',
  NEXT_PUBLIC_APP_URL: 'http://localhost:3002',
  E2E_DB_ADMIN_URL: 'postgresql://nzila:nzila_dev@localhost:5433/postgres',
} as const

let cached: GovernedE2EEnv | null = null

function loadDotenvFiles(appRoot: string): void {
  const candidates = [
    path.join(appRoot, 'tests/e2e/.env.test.local'),
    path.join(appRoot, 'tests/e2e/.env.test'),
    path.join(appRoot, '.env.test.local'),
    path.join(appRoot, '.env.test'),
    path.join(appRoot, '.env.local'),
  ]
  for (const p of candidates) {
    if (fs.existsSync(p)) {
      dotenv.config({ path: p, override: false })
    }
  }
}

function resolveOrDefault(name: string, fallback?: string): string {
  const raw = process.env[name]
  const trimmed = raw?.trim()
  if (trimmed && trimmed.length > 0) return trimmed
  if (typeof fallback === 'string') return fallback
  return ''
}

function assertNotProduction(): void {
  const mode = (process.env.NODE_ENV ?? '').toLowerCase()
  if (mode === 'production') {
    throw new Error(
      '[ue:e2e:env] Refused: NODE_ENV=production. Governed E2E lifecycle MUST NOT run against production.',
    )
  }
}

/** Assert a DATABASE_URL does not look production-shaped. */
export function assertNotProductionUrl(url: string, allowProdUrl: boolean): void {
  if (allowProdUrl) return
  const lower = url.toLowerCase()
  const hit = PROD_URL_HINTS.find((h) => lower.includes(h))
  if (hit) {
    throw new Error(
      `[ue:e2e:env] Refused: DATABASE_URL appears production-shaped (hint='${hit}'). Set QA_TEST_ENV_ALLOW_PROD_URL=true to override — DO NOT do this in normal use.`,
    )
  }
}

function assertUrl(name: string, value: string): void {
  try {
    // eslint-disable-next-line no-new
    new URL(value)
  } catch {
    throw new Error(`[ue:e2e:env] Invalid URL for ${name}: '${value}'`)
  }
}

function assertSecret(name: string, value: string): void {
  if (!value || value.trim().length < REQUIRED_MIN_SECRET_LENGTH) {
    throw new Error(
      `[ue:e2e:env] ${name} must be a non-empty string of ≥ ${REQUIRED_MIN_SECRET_LENGTH} chars (got length=${value?.length ?? 0}).`,
    )
  }
}

/**
 * Load and validate the governed E2E environment.
 *
 * If requireDatabaseUrl=false (the default), DATABASE_URL may be empty at load
 * time — the disposable-DB allocator will populate it after loadEnv() and
 * before boot.
 */
export function loadGovernedE2EEnv(options: LoadOptions = {}): GovernedE2EEnv {
  if (cached) return cached

  const appRoot = options.appRoot ?? path.resolve(__dirname, '..', '..')
  const allowProdUrl =
    options.allowProdUrl ??
    (process.env.QA_TEST_ENV_ALLOW_PROD_URL ?? '').toLowerCase() === 'true'

  loadDotenvFiles(appRoot)
  assertNotProduction()

  const env: GovernedE2EEnv = {
    NODE_ENV: 'test',
    QA_TEST_ENV: 'true',
    PLAYWRIGHT_TEST_AUTH: 'true',
    UE_E2E_RISK_BYPASS: 'true',
    PLAYWRIGHT_BASE_URL: resolveOrDefault(
      'PLAYWRIGHT_BASE_URL',
      DETERMINISTIC_TEST_DEFAULTS.PLAYWRIGHT_BASE_URL,
    ),
    NEXT_PUBLIC_APP_URL: resolveOrDefault(
      'NEXT_PUBLIC_APP_URL',
      DETERMINISTIC_TEST_DEFAULTS.NEXT_PUBLIC_APP_URL,
    ),
    AUTH_SECRET: resolveOrDefault('AUTH_SECRET', DETERMINISTIC_TEST_DEFAULTS.AUTH_SECRET),
    VOTING_SECRET: resolveOrDefault('VOTING_SECRET', DETERMINISTIC_TEST_DEFAULTS.VOTING_SECRET),
    DJANGO_SECRET_KEY: resolveOrDefault(
      'DJANGO_SECRET_KEY',
      DETERMINISTIC_TEST_DEFAULTS.DJANGO_SECRET_KEY,
    ),
    NEXTAUTH_SECRET: resolveOrDefault(
      'NEXTAUTH_SECRET',
      DETERMINISTIC_TEST_DEFAULTS.NEXTAUTH_SECRET,
    ),
    DATABASE_URL: resolveOrDefault('DATABASE_URL'),
    E2E_DB_ADMIN_URL: resolveOrDefault(
      'E2E_DB_ADMIN_URL',
      DETERMINISTIC_TEST_DEFAULTS.E2E_DB_ADMIN_URL,
    ),
    E2E_PRESERVE_DB: (process.env.E2E_PRESERVE_DB ?? '').toLowerCase() === 'true' ? 'true' : undefined,
    E2E_PORT: process.env.E2E_PORT?.trim() || undefined,
  }

  // Validate URLs
  assertUrl('PLAYWRIGHT_BASE_URL', env.PLAYWRIGHT_BASE_URL)
  assertUrl('NEXT_PUBLIC_APP_URL', env.NEXT_PUBLIC_APP_URL)

  // Validate secrets
  assertSecret('AUTH_SECRET', env.AUTH_SECRET)
  assertSecret('VOTING_SECRET', env.VOTING_SECRET)
  assertSecret('DJANGO_SECRET_KEY', env.DJANGO_SECRET_KEY)
  assertSecret('NEXTAUTH_SECRET', env.NEXTAUTH_SECRET)

  // Validate DB URLs (E2E_DB_ADMIN_URL always required; DATABASE_URL only if requested)
  if (!env.E2E_DB_ADMIN_URL) {
    throw new Error('[ue:e2e:env] E2E_DB_ADMIN_URL is required (use postgres://... to /postgres).')
  }
  assertNotProductionUrl(env.E2E_DB_ADMIN_URL, allowProdUrl)

  if (options.requireDatabaseUrl) {
    if (!env.DATABASE_URL) {
      throw new Error(
        '[ue:e2e:env] DATABASE_URL is required. Either export it, or let the disposable-DB allocator create one.',
      )
    }
    assertNotProductionUrl(env.DATABASE_URL, allowProdUrl)
  } else if (env.DATABASE_URL) {
    assertNotProductionUrl(env.DATABASE_URL, allowProdUrl)
  }

  // Port conflict check (soft — informational)
  if (env.E2E_PORT) {
    const port = Number(env.E2E_PORT)
    if (!Number.isFinite(port) || port <= 0 || port > 65535) {
      throw new Error(`[ue:e2e:env] E2E_PORT must be a valid port number (got '${env.E2E_PORT}').`)
    }
  }

  cached = env
  return env
}

/** Testing helper: clear cached state. */
export function _resetGovernedE2EEnvCache(): void {
  cached = null
}

/** Safely-loggable summary — never returns secret values. */
export function summarizeGovernedE2EEnv(env: GovernedE2EEnv): Record<string, string> {
  const summary: Record<string, string> = {
    NODE_ENV: env.NODE_ENV,
    QA_TEST_ENV: env.QA_TEST_ENV,
    PLAYWRIGHT_TEST_AUTH: env.PLAYWRIGHT_TEST_AUTH,
    UE_E2E_RISK_BYPASS: env.UE_E2E_RISK_BYPASS,
    PLAYWRIGHT_BASE_URL: env.PLAYWRIGHT_BASE_URL,
    NEXT_PUBLIC_APP_URL: env.NEXT_PUBLIC_APP_URL,
    AUTH_SECRET: `<redacted:${env.AUTH_SECRET.length}chars>`,
    VOTING_SECRET: `<redacted:${env.VOTING_SECRET.length}chars>`,
    DJANGO_SECRET_KEY: `<redacted:${env.DJANGO_SECRET_KEY.length}chars>`,
    NEXTAUTH_SECRET: `<redacted:${env.NEXTAUTH_SECRET.length}chars>`,
    DATABASE_URL: env.DATABASE_URL ? redactUrl(env.DATABASE_URL) : '<unset — allocator will provide>',
    E2E_DB_ADMIN_URL: redactUrl(env.E2E_DB_ADMIN_URL),
  }
  if (env.E2E_PRESERVE_DB) summary.E2E_PRESERVE_DB = env.E2E_PRESERVE_DB
  if (env.E2E_PORT) summary.E2E_PORT = env.E2E_PORT
  return summary
}

/** Redact user/password from a postgres URL, keep host+db for diagnostics. */
export function redactUrl(url: string): string {
  try {
    const u = new URL(url)
    const user = u.username ? '<user>' : ''
    const pass = u.password ? ':<pw>' : ''
    const at = user || pass ? '@' : ''
    return `${u.protocol}//${user}${pass}${at}${u.host}${u.pathname}`
  } catch {
    return '<unparseable-url>'
  }
}

/** Apply the loaded env to process.env so downstream children inherit it. */
export function applyEnvToProcess(env: GovernedE2EEnv): void {
  for (const [key, value] of Object.entries(env)) {
    if (value === undefined) continue
    process.env[key] = String(value)
  }
}
