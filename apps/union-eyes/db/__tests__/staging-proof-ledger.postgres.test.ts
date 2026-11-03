/**
 * The staging proof ledger on real PostgreSQL, as the system role (UE-CONV-H-016).
 *
 * The staging proof route (POST /api/staging-proof/deadline-engine/scenario) wrote three relations that existed only in the DDL of its PGlite test, so on a real database
 * the harness failed on its first statement and nothing noticed: the mismatch census (scripts/runtime/mismatch-census.ts) found it. Platform 0078 creates them, cache
 * 0054 closes them with row-level security, and the storage-authority manifest classifies them SYSTEM_ONLY. This runs lib/staging-proof/ledger.ts unmodified over the
 * real relations, through the system role as the route does. What it holds:
 *   - the relations exist as declared, tagged, with forced row-level security and exactly one policy (the system role's); the tenant runtime role holds no privilege on
 *     any of them, and the system role holds exactly what the manifest names: INSERT and SELECT on the nonce and event relations, INSERT, SELECT and UPDATE on the run
 *     relation, and no DELETE anywhere, so no role can change or remove an event or a nonce;
 *   - a nonce is accepted once, atomically: two concurrent requests with one nonce cannot both open a run, and the loser writes nothing;
 *   - a run is settled once: the closing event and the status commit together, a second settlement or a settlement of an unknown run writes nothing;
 *   - the database refuses what the writer relies on being true: a status or event type outside the set, a finalized time on a started run (or none on a settled one),
 *     a run for a nonce that was never used, an event for a run that does not exist;
 *   - the migration is reversible and re-appliable: the rollback refuses while the ledger holds rows, removes exactly the tagged relations when it is empty, and applying
 *     the migration and the row-security closure again restores the same shape.
 *
 * Skipped unless UE_AUTHORITY_COMBINED_URL points at an ADMIN connection to a disposable, fully bootstrapped database.
 */
import { randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import pg from 'pg'
import postgres from 'postgres'
import { drizzle } from 'drizzle-orm/postgres-js'
import { sql } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { serializeRawDates } from '@/db/driver-dates'

const URL = process.env.UE_AUTHORITY_COMBINED_URL
const APP_ROOT = join(__dirname, '..', '..')
const state = vi.hoisted(() => ({ db: null as unknown }))
const TABLES = ['staging_proof_nonce_uses', 'staging_proof_runs', 'staging_proof_run_events'] as const

async function runAs<T>(role: string, work: (tx: { execute: (query: unknown) => Promise<unknown> }) => Promise<T>): Promise<T> {
  const db = state.db as { transaction: <R>(fn: (tx: { execute: (query: unknown) => Promise<unknown> }) => Promise<R>) => Promise<R> }
  return db.transaction(async (tx) => {
    await tx.execute(sql.raw(`SET LOCAL ROLE ${role}`))
    return work(tx)
  })
}

vi.mock('@/lib/db/with-rls-context', () => ({
  withSystemContext: (operation: (tx: unknown) => Promise<unknown>) => runAs('union_eyes_system', operation as never),
}))

const ledger = URL ? await import('@/lib/staging-proof/ledger') : null

function codeOf(error: unknown): string | undefined {
  let current = error as { code?: unknown; cause?: unknown } | undefined
  for (let depth = 0; current && depth < 5; depth += 1) {
    if (typeof current.code === 'string' && /^[0-9A-Z]{5}$/.test(current.code)) return current.code
    current = current.cause as typeof current
  }
  return undefined
}

const statementsOf = (file: string, directory = 'migrations-platform') =>
  readFileSync(join(APP_ROOT, 'db', directory, file), 'utf8')
    .split('--> statement-breakpoint')
    .map((statement) => statement.trim())
    .filter(Boolean)

describe.skipIf(!URL)('the staging proof ledger over the real relations, as the system role', () => {
  let admin: pg.Client
  let client: ReturnType<typeof postgres>
  const rows = async (query: string, params: unknown[] = []) => (await admin.query(query, params)).rows
  const open = (nonce: string, proofRunId = randomUUID()) => ledger!.createProofRun({ proofRunId, nonce, scenario: 'schedule-basic', correlationId: `corr-${proofRunId}` })
  const counts = async () =>
    Object.fromEntries(await Promise.all(TABLES.map(async (table) => [table, Number((await rows(`SELECT count(*)::int n FROM ${table}`))[0].n)])))

  beforeAll(async () => {
    admin = new pg.Client({ connectionString: URL })
    await admin.connect()
    client = postgres(URL!, { max: 4, onnotice: () => undefined })
    state.db = drizzle(client)
    serializeRawDates(client)
  }, 120_000)

  afterAll(async () => {
    await client?.end({ timeout: 5 }).catch(() => undefined)
    await admin?.end().catch(() => undefined)
  })

  it('has the three relations as declared, tagged, with forced row-level security and one policy, the system role\'s', async () => {
    const found = await rows(
      `SELECT c.relname, c.relrowsecurity, c.relforcerowsecurity, obj_description(c.oid, 'pg_class') AS tag,
              (SELECT count(*)::int FROM information_schema.columns k WHERE k.table_schema = 'public' AND k.table_name = c.relname) AS columns,
              (SELECT array_agg(p.polname || ':' || array_to_string(ARRAY(SELECT rolname FROM pg_roles WHERE oid = ANY(p.polroles)), ',') ORDER BY p.polname) FROM pg_policy p WHERE p.polrelid = c.oid) AS policies
         FROM pg_class c WHERE c.relnamespace = 'public'::regnamespace AND c.relname = ANY($1) ORDER BY c.relname`,
      [[...TABLES]],
    )
    expect(found).toEqual([
      { relname: 'staging_proof_nonce_uses', relrowsecurity: true, relforcerowsecurity: true, tag: 'platform-migration:staging_proof_ledger', columns: 4, policies: ['ue_system_full_access:union_eyes_system'] },
      { relname: 'staging_proof_run_events', relrowsecurity: true, relforcerowsecurity: true, tag: 'platform-migration:staging_proof_ledger', columns: 10, policies: ['ue_system_full_access:union_eyes_system'] },
      { relname: 'staging_proof_runs', relrowsecurity: true, relforcerowsecurity: true, tag: 'platform-migration:staging_proof_ledger', columns: 8, policies: ['ue_system_full_access:union_eyes_system'] },
    ])
  })

  it('grants the tenant runtime role nothing, and the system role exactly what the manifest names', async () => {
    const privilege = async (role: string, table: string) =>
      Object.fromEntries(
        await Promise.all(['SELECT', 'INSERT', 'UPDATE', 'DELETE'].map(async (operation) => [operation, (await rows(`SELECT has_table_privilege($1, $2, $3) AS held`, [role, `public.${table}`, operation]))[0].held])),
      )
    for (const table of TABLES) {
      expect(await privilege('union_eyes_runtime', table), `runtime on ${table}`).toEqual({ SELECT: false, INSERT: false, UPDATE: false, DELETE: false })
    }
    expect(await privilege('union_eyes_system', 'staging_proof_nonce_uses')).toEqual({ SELECT: true, INSERT: true, UPDATE: false, DELETE: false })
    expect(await privilege('union_eyes_system', 'staging_proof_runs')).toEqual({ SELECT: true, INSERT: true, UPDATE: true, DELETE: false })
    expect(await privilege('union_eyes_system', 'staging_proof_run_events')).toEqual({ SELECT: true, INSERT: true, UPDATE: false, DELETE: false })
  })

  it('refuses the tenant runtime role every statement, and the system role every change to an event or a nonce', async () => {
    for (const table of TABLES) {
      const code = await runAs('union_eyes_runtime', (tx) => tx.execute(sql.raw(`SELECT 1 FROM ${table} LIMIT 1`))).then(() => undefined, codeOf)
      expect(code, `runtime reads ${table}`).toBe('42501')
    }
    const refused = (statement: string) => runAs('union_eyes_system', (tx) => tx.execute(sql.raw(statement))).then(() => undefined, codeOf)
    expect(await refused(`UPDATE staging_proof_run_events SET scenario = 'x'`)).toBe('42501')
    expect(await refused(`DELETE FROM staging_proof_run_events`)).toBe('42501')
    expect(await refused(`UPDATE staging_proof_nonce_uses SET proof_run_id = proof_run_id`)).toBe('42501')
    expect(await refused(`DELETE FROM staging_proof_nonce_uses`)).toBe('42501')
    expect(await refused(`DELETE FROM staging_proof_runs`)).toBe('42501')
  })

  it('opens a run for a nonce once: the nonce, the run and the started event commit together', async () => {
    const nonce = `n-${randomUUID()}`
    const proofRunId = randomUUID()
    expect(await open(nonce, proofRunId)).toBe(true)
    expect(await rows(`SELECT proof_run_id::text, expires_at > now() AS live FROM staging_proof_nonce_uses WHERE nonce = $1`, [nonce])).toEqual([{ proof_run_id: proofRunId, live: true }])
    expect(await rows(`SELECT id::text, nonce, scenario, status, cleanup_passed, finalized_at FROM staging_proof_runs WHERE id = $1`, [proofRunId])).toEqual([
      { id: proofRunId, nonce, scenario: 'schedule-basic', status: 'started', cleanup_passed: null, finalized_at: null },
    ])
    expect(await rows(`SELECT event_type, expected_outcome FROM staging_proof_run_events WHERE proof_run_id = $1`, [proofRunId])).toEqual([
      { event_type: 'started', expected_outcome: { service_boundary: true, cleanup: true } },
    ])
  })

  it('refuses a nonce that has been used, writing nothing', async () => {
    const nonce = `n-${randomUUID()}`
    expect(await open(nonce)).toBe(true)
    const before = await counts()
    expect(await open(nonce)).toBe(false)
    expect(await counts()).toEqual(before)
  })

  it('lets only one of two concurrent requests with the same nonce open a run', async () => {
    const nonce = `n-${randomUUID()}`
    const before = await counts()
    const outcomes = await Promise.all([open(nonce), open(nonce), open(nonce)])
    expect(outcomes.filter(Boolean)).toHaveLength(1)
    const after = await counts()
    expect(after.staging_proof_nonce_uses - before.staging_proof_nonce_uses).toBe(1)
    expect(after.staging_proof_runs - before.staging_proof_runs).toBe(1)
    expect(after.staging_proof_run_events - before.staging_proof_run_events).toBe(1)
  })

  it('settles a started run once, with its closing event in the same transaction', async () => {
    const proofRunId = randomUUID()
    expect(await open(`n-${randomUUID()}`, proofRunId)).toBe(true)
    await ledger!.finalizeProofRun({
      proofRunId,
      scenario: 'schedule-basic',
      eventType: 'completed',
      correlationId: `corr-${proofRunId}`,
      createdIdentifiers: { organizationId: 'org-1' },
      actualOutcome: { reminders_created: true },
      cleanupPassed: true,
    })
    expect(await rows(`SELECT status, cleanup_passed, finalized_at IS NOT NULL AS settled FROM staging_proof_runs WHERE id = $1`, [proofRunId])).toEqual([
      { status: 'completed', cleanup_passed: true, settled: true },
    ])
    // The two events are written by two transactions, so created_at orders them: opened first, settled second.
    expect(await rows(`SELECT event_type, created_identifiers, actual_outcome, cleanup_passed FROM staging_proof_run_events WHERE proof_run_id = $1 ORDER BY created_at`, [proofRunId])).toEqual([
      { event_type: 'started', created_identifiers: null, actual_outcome: null, cleanup_passed: null },
      { event_type: 'completed', created_identifiers: { organizationId: 'org-1' }, actual_outcome: { reminders_created: true }, cleanup_passed: true },
    ])
  })

  it('writes nothing for a second settlement or for a run that does not exist', async () => {
    const proofRunId = randomUUID()
    expect(await open(`n-${randomUUID()}`, proofRunId)).toBe(true)
    const settle = (id: string, eventType: 'completed' | 'failed') =>
      ledger!.finalizeProofRun({ proofRunId: id, scenario: 'schedule-basic', eventType, correlationId: 'c', actualOutcome: {}, cleanupPassed: false })
    await settle(proofRunId, 'failed')
    const before = await counts()
    await expect(settle(proofRunId, 'completed')).rejects.toThrow('proof run is missing or already finalized')
    await expect(settle(randomUUID(), 'completed')).rejects.toThrow('proof run is missing or already finalized')
    expect(await counts()).toEqual(before)
    expect(await rows(`SELECT status FROM staging_proof_runs WHERE id = $1`, [proofRunId])).toEqual([{ status: 'failed' }])
  })

  it('refuses what the writer relies on being true', async () => {
    const violation = (statement: string, params: unknown[] = []) => admin.query(statement, params).then(() => undefined, (error) => codeOf(error))
    const nonce = `n-${randomUUID()}`
    const proofRunId = randomUUID()
    expect(await open(nonce, proofRunId)).toBe(true)

    // A status outside the set, a finalized time on a started run, and a settled run with no finalized time.
    expect(await violation(`UPDATE staging_proof_runs SET status = 'running' WHERE id = $1`, [proofRunId])).toBe('23514')
    expect(await violation(`UPDATE staging_proof_runs SET finalized_at = now() WHERE id = $1`, [proofRunId])).toBe('23514')
    expect(await violation(`UPDATE staging_proof_runs SET status = 'completed' WHERE id = $1`, [proofRunId])).toBe('23514')
    // A run for a nonce nobody used, a second run for a used nonce, and an event for a run that does not exist.
    expect(await violation(`INSERT INTO staging_proof_runs (id, nonce, scenario, correlation_id, status) VALUES ($1, 'never-used', 's', 'c', 'started')`, [randomUUID()])).toBe('23503')
    expect(await violation(`INSERT INTO staging_proof_runs (id, nonce, scenario, correlation_id, status) VALUES ($1, $2, 's', 'c', 'started')`, [randomUUID(), nonce])).toBe('23505')
    expect(await violation(`INSERT INTO staging_proof_run_events (proof_run_id, scenario, event_type, correlation_id) VALUES ($1, 's', 'started', 'c')`, [randomUUID()])).toBe('23503')
    expect(await violation(`INSERT INTO staging_proof_run_events (proof_run_id, scenario, event_type, correlation_id) VALUES ($1, 's', 'paused', 'c')`, [proofRunId])).toBe('23514')
    // The same nonce text again is the primary key's refusal.
    expect(await violation(`INSERT INTO staging_proof_nonce_uses (nonce, proof_run_id, expires_at) VALUES ($1, $2, now())`, [nonce, randomUUID()])).toBe('23505')
  })

  it('rolls back only while empty, removes exactly the tagged relations, and applies again to the same shape', async () => {
    const rollback = statementsOf('0078_staging_proof_ledger.rollback.sql')
    const run = async (statements: string[]) => {
      for (const statement of statements) await admin.query(statement)
    }
    // The ledger holds rows (every test above wrote some): the rollback refuses and drops nothing.
    await expect(run(rollback)).rejects.toThrow(/holds rows/)
    expect((await counts()).staging_proof_runs).toBeGreaterThan(0)

    await admin.query('TRUNCATE staging_proof_run_events, staging_proof_runs, staging_proof_nonce_uses')
    await run(statementsOf('0054_staging_proof_ledger_rls_closure.rollback.sql', 'migrations-cache'))
    await run(rollback)
    expect(await rows(`SELECT 1 FROM pg_class WHERE relnamespace = 'public'::regnamespace AND relname = ANY($1)`, [[...TABLES]])).toHaveLength(0)

    await run(statementsOf('0078_staging_proof_ledger.sql'))
    await run(statementsOf('0054_staging_proof_ledger_rls_closure.sql', 'migrations-cache'))
    const again = await rows(
      `SELECT c.relname, c.relforcerowsecurity, (SELECT count(*)::int FROM pg_policy p WHERE p.polrelid = c.oid) AS policies FROM pg_class c WHERE c.relnamespace = 'public'::regnamespace AND c.relname = ANY($1) ORDER BY c.relname`,
      [[...TABLES]],
    )
    expect(again).toEqual([
      { relname: 'staging_proof_nonce_uses', relforcerowsecurity: true, policies: 1 },
      { relname: 'staging_proof_run_events', relforcerowsecurity: true, policies: 1 },
      { relname: 'staging_proof_runs', relforcerowsecurity: true, policies: 1 },
    ])
  })
})
