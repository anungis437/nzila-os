/**
 * Phase 0C.1 §7 — Disposable PostgreSQL database allocator.
 *
 * Contract:
 *   - Connects to E2E_DB_ADMIN_URL (default: postgres://nzila@localhost:5433/postgres).
 *   - CREATE DATABASE with a unique name (ue_e2e_<ts>_<rand>).
 *   - Applies Union Eyes drizzle migrations (via `pnpm ue:db:bootstrap`).
 *   - Returns { runId, dbName, url } for the caller.
 *   - Refuses production URLs (delegates to env.assertNotProductionUrl).
 *   - Records lifecycle in .e2e-lifecycle/history.jsonl (one line per run).
 *   - drop() drops the DB unless E2E_PRESERVE_DB=true.
 *
 * Independence guarantees:
 *   - NEVER reads from or writes to `nzila_automation` (developer DB).
 *   - NEVER uses `drizzle-kit push`.
 *   - Explicitly separates the admin URL (postgres) from the app URL (the
 *     new disposable DB).
 */

import { spawnSync } from 'node:child_process'
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { Client } from 'pg'
import { assertNotProductionUrl, redactUrl } from './env'

export interface AllocateOptions {
  /** Admin URL (defaults to E2E_DB_ADMIN_URL). Should end in /postgres. */
  adminUrl?: string
  /** DB name prefix (default 'ue_e2e'). */
  prefix?: string
  /** Owner role name (default 'nzila'). */
  owner?: string
  /** Repo root (default = auto-detect). */
  repoRoot?: string
  /** Skip running migrations (for tests only). */
  skipMigrations?: boolean
  /** Allow production URL. Never true in normal use. */
  allowProdUrl?: boolean
}

export interface AllocateResult {
  runId: string
  dbName: string
  /** Full DATABASE_URL for the newly-created DB. */
  url: string
  /** Directory holding lifecycle artefacts for this run. */
  runDir: string
  /** When true, drop() will refuse to drop. */
  preserved: boolean
}

const LIFECYCLE_DIR = '.e2e-lifecycle'
const HISTORY_FILE = 'history.jsonl'

function generateRunId(prefix: string): { runId: string; dbName: string } {
  // Postgres identifiers max 63 chars. Keep the DB name compact.
  const ts = new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14) // YYYYMMDDhhmmss
  const rand = crypto.randomBytes(3).toString('hex') // 6 chars
  const dbName = `${prefix}_${ts}_${rand}`.toLowerCase()
  const runId = `${ts}_${rand}`
  return { runId, dbName }
}

function toAdminUrl(input: string): URL {
  const u = new URL(input)
  // Force /postgres for admin ops even if caller passed a specific DB
  u.pathname = '/postgres'
  return u
}

/**
 * Resolve the admin URL, preferring the explicit option, then the
 * `E2E_DB_ADMIN_URL` environment variable. Never falls back to a hardcoded
 * literal — the deterministic test default lives ONLY in the governed env
 * loader (`env.ts::DETERMINISTIC_TEST_DEFAULTS`) and callers of allocate-db
 * are expected to route through `loadGovernedE2EEnv()` (see `run.ts`) or set
 * `E2E_DB_ADMIN_URL` explicitly (see `.env.test` or CI). Throws with a
 * diagnostic when neither is present.
 *
 * Phase 0C.2 §3 — removes the hardcoded fallback that was flagged by
 * Gitleaks and would have required an ever-widening `.gitleaksignore`.
 */
function resolveAdminUrl(explicit: string | undefined, callerLabel: string): string {
  const explicitTrim = explicit?.trim()
  if (explicitTrim && explicitTrim.length > 0) return explicitTrim
  const envTrim = process.env.E2E_DB_ADMIN_URL?.trim()
  if (envTrim && envTrim.length > 0) return envTrim
  throw new Error(
    `[ue:e2e:allocate-db] ${callerLabel}: E2E_DB_ADMIN_URL is required. ` +
      `Either export it in the environment (see apps/union-eyes/tests/e2e/.env.test), ` +
      `call the governed env loader (loadGovernedE2EEnv from ./env), or pass ` +
      `options.adminUrl explicitly. The hardcoded local-dev fallback was removed ` +
      `in Phase 0C.2 §3 for supply-chain hygiene.`,
  )
}

function buildDbUrl(adminUrl: string, dbName: string): string {
  const u = new URL(adminUrl)
  u.pathname = `/${dbName}`
  return u.toString()
}

function resolveRepoRoot(explicit?: string): string {
  if (explicit) return explicit
  // env.ts sits at apps/union-eyes/scripts/lifecycle/env.ts.
  // repoRoot = 4 levels up from THIS file (scripts/lifecycle/allocate-db.ts).
  return path.resolve(__dirname, '..', '..', '..', '..')
}

function ensureLifecycleDir(repoRoot: string): string {
  const dir = path.join(repoRoot, 'apps', 'union-eyes', LIFECYCLE_DIR)
  fs.mkdirSync(dir, { recursive: true })
  return dir
}

function appendHistory(repoRoot: string, entry: Record<string, unknown>): void {
  const dir = ensureLifecycleDir(repoRoot)
  const file = path.join(dir, HISTORY_FILE)
  fs.appendFileSync(file, JSON.stringify({ ts: new Date().toISOString(), ...entry }) + '\n', 'utf8')
}

/**
 * Create the disposable DB, run migrations, return connection info.
 */
export async function allocateDatabase(options: AllocateOptions = {}): Promise<AllocateResult> {
  const allowProdUrl =
    options.allowProdUrl ?? (process.env.QA_TEST_ENV_ALLOW_PROD_URL ?? '').toLowerCase() === 'true'
  const adminUrlRaw = resolveAdminUrl(options.adminUrl, 'allocateDatabase')
  assertNotProductionUrl(adminUrlRaw, allowProdUrl)

  const nodeEnv = (process.env.NODE_ENV ?? '').toLowerCase()
  if (nodeEnv === 'production') {
    throw new Error('[ue:e2e:allocate-db] Refused: NODE_ENV=production.')
  }

  const adminUrl = toAdminUrl(adminUrlRaw).toString()
  const prefix = options.prefix ?? 'ue_e2e'
  const owner = options.owner ?? 'nzila'
  const repoRoot = resolveRepoRoot(options.repoRoot)

  const { runId, dbName } = generateRunId(prefix)
  const url = buildDbUrl(adminUrl, dbName)
  const runDir = path.join(ensureLifecycleDir(repoRoot), 'runs', runId)
  fs.mkdirSync(runDir, { recursive: true })

  // eslint-disable-next-line no-console
  console.log(
    `[ue:e2e:allocate-db] Creating disposable DB '${dbName}' via ${redactUrl(adminUrl)} (owner=${owner})`,
  )

  const admin = new Client({ connectionString: adminUrl })
  await admin.connect()
  try {
    // Identifiers must be sanitized — dbName is generated by us so it's safe,
    // but validate defensively.
    if (!/^[a-z0-9_]+$/i.test(dbName) || dbName.length > 63) {
      throw new Error(`[ue:e2e:allocate-db] Refusing unsafe db name '${dbName}'`)
    }
    if (!/^[a-z0-9_]+$/i.test(owner) || owner.length > 63) {
      throw new Error(`[ue:e2e:allocate-db] Refusing unsafe owner name '${owner}'`)
    }
    await admin.query(`CREATE DATABASE "${dbName}" OWNER "${owner}"`)
  } finally {
    await admin.end()
  }

  appendHistory(repoRoot, {
    event: 'allocate',
    runId,
    dbName,
    adminHost: new URL(adminUrl).host,
    owner,
  })

  if (!options.skipMigrations) {
    try {
      runMigrations(repoRoot, url, runDir)
      appendHistory(repoRoot, { event: 'migrated', runId, dbName })
    } catch (err) {
      // Roll back the just-created DB so we don't leak orphan databases when
      // the migration pipeline aborts mid-way.
      appendHistory(repoRoot, {
        event: 'migration-failed-rollback',
        runId,
        dbName,
        error: err instanceof Error ? err.message : String(err),
      })
      const rollback = new Client({ connectionString: adminUrl })
      try {
        await rollback.connect()
        await rollback.query(
          `SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid()`,
          [dbName],
        )
        await rollback.query(`DROP DATABASE IF EXISTS "${dbName}"`)
        appendHistory(repoRoot, { event: 'rollback-dropped', runId, dbName })
      } catch (dropErr) {
        appendHistory(repoRoot, {
          event: 'rollback-failed',
          runId,
          dbName,
          error: dropErr instanceof Error ? dropErr.message : String(dropErr),
        })
        // eslint-disable-next-line no-console
        console.error(
          `[ue:e2e:allocate-db] Rollback drop failed for ${dbName}: ${
            dropErr instanceof Error ? dropErr.message : dropErr
          }. Manual cleanup required.`,
        )
      } finally {
        try {
          await rollback.end()
        } catch {
          /* ignore */
        }
      }
      throw err
    }
  }

  const preserved = (process.env.E2E_PRESERVE_DB ?? '').toLowerCase() === 'true'

  return { runId, dbName, url, runDir, preserved }
}

/**
 * Invoke the canonical UE migration pipeline against the disposable DB.
 *
 * COMPLIANT PIPELINE (Phase 0C.2 §6 refactor, effective 2026-07-23):
 *   → tooling/scripts/run-union-eyes-drizzle-bootstrap.mjs
 *
 * The compliant bootstrap runner is the ONLY governed entry point. It:
 *   (a) Enforces the .lineage-frozen sentinel on apps/union-eyes/db/migrations/
 *       and refuses to touch the frozen legacy lineage unless the caller
 *       provides BOTH UE_LINEAGE_REPLAY_OVERRIDE=1 and
 *       UE_LINEAGE_REPLAY_REASON.
 *   (b) Applies scoped Drizzle migrations from apps/union-eyes/db/migrations-cache/.
 *   (c) Applies tooling/sql/union-eyes-qa-baseline.sql (idempotent minimum
 *       schema for QA/CI).
 *   (d) Optionally restores a canonical Django-owned snapshot when
 *       UE_DB_RESTORE_SNAPSHOT_URL is set.
 *
 * Why this changed:
 *   The previous Phase 0C.1 pipeline invoked a second stage
 *   `run-union-eyes-drizzle-migrate.mjs` which replayed the entire frozen
 *   legacy lineage (97 SQL files in apps/union-eyes/db/migrations/). That
 *   replay violates the freeze contract documented in
 *   docs/categories/platform-and-operations/architecture/orm-governance/historical-migration-lineage-governance.md
 *   §4 (replay prohibitions) and §6 (replay-refusal contract). The replay
 *   also unavoidably aborted inside 0008_lean_mother_askani.sql at
 *   statement #7 105 (`relation "knowledge_base" does not exist`) — see
 *   reports/audits/cupe-national-phase-0/phase-0c/phase-0c2-migration-0008-forensic-analysis.md.
 *
 *   The compliant bootstrap already produces a functionally complete
 *   schema for the disposable-DB E2E target environment. No second stage
 *   is required. If any E2E-required table proves absent, the correct
 *   remediation is a NEW scoped migration under db/migrations-cache/,
 *   NOT a resurrection of the legacy replay.
 */
function runMigrations(repoRoot: string, dbUrl: string, runDir: string): void {
  const bootstrapScript = path.join(
    repoRoot,
    'tooling',
    'scripts',
    'run-union-eyes-drizzle-bootstrap.mjs',
  )
  if (!fs.existsSync(bootstrapScript)) {
    throw new Error(
      `[ue:e2e:allocate-db] Compliant migration runner not found at ${bootstrapScript}. Cannot proceed.`,
    )
  }

  const logFile = path.join(runDir, 'migrations.log')
  fs.writeFileSync(
    logFile,
    `[ue:e2e:allocate-db] Phase 0C.2 compliant runner: ${bootstrapScript}\n` +
      `[ue:e2e:allocate-db] Legacy replay refused per historical-migration-lineage-governance.md §4/§6.\n`,
    'utf8',
  )
  fs.appendFileSync(logFile, `\n===== stage: bootstrap (${bootstrapScript}) =====\n`, 'utf8')

  const child = spawnSync('node', [bootstrapScript], {
    cwd: repoRoot,
    env: { ...process.env, DATABASE_URL: dbUrl },
    encoding: 'utf8',
    stdio: 'pipe',
  })
  const combined = `${child.stdout ?? ''}\n${child.stderr ?? ''}`
  fs.appendFileSync(logFile, combined, 'utf8')
  if (child.status !== 0) {
    // eslint-disable-next-line no-console
    console.error(`[ue:e2e:allocate-db] bootstrap runner failed:\n${combined}`)
    throw new Error(
      `[ue:e2e:allocate-db] Compliant migration runner failed (exit=${child.status}). See ${logFile}.`,
    )
  }
}

/** Drop the disposable DB unless preserved. */
export async function dropDatabase(
  allocation: AllocateResult,
  options: { adminUrl?: string; repoRoot?: string } = {},
): Promise<{ dropped: boolean; reason?: string }> {
  const adminUrlRaw = resolveAdminUrl(options.adminUrl, 'dropDatabase')
  const adminUrl = toAdminUrl(adminUrlRaw).toString()
  const repoRoot = resolveRepoRoot(options.repoRoot)

  if (allocation.preserved) {
    appendHistory(repoRoot, {
      event: 'drop-skipped',
      runId: allocation.runId,
      dbName: allocation.dbName,
      reason: 'E2E_PRESERVE_DB=true',
    })
    return { dropped: false, reason: 'preserved' }
  }

  const admin = new Client({ connectionString: adminUrl })
  await admin.connect()
  try {
    // Force-terminate any lingering connections; safe on postgres 13+.
    await admin.query(
      `SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid()`,
      [allocation.dbName],
    )
    await admin.query(`DROP DATABASE IF EXISTS "${allocation.dbName}"`)
  } finally {
    await admin.end()
  }

  appendHistory(repoRoot, {
    event: 'dropped',
    runId: allocation.runId,
    dbName: allocation.dbName,
  })

  return { dropped: true }
}

/** For diagnostics. */
export function _formatAllocationSummary(a: AllocateResult): string {
  return `runId=${a.runId} db=${a.dbName} url=${redactUrl(a.url)} runDir=${a.runDir} preserved=${a.preserved}`
}
