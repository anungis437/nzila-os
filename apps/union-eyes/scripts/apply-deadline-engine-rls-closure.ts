#!/usr/bin/env tsx
/**
 * apply-deadline-engine-rls-closure.ts — mission UE-RUNTIME-REALITY-20261018.
 *
 * Applies (or rolls back) db/migrations/20261018_deadline_engine_rls_fail_closed_closure.sql
 * in ONE transaction, printing the SHA-256 of the SQL and a before/after catalog
 * state for the three deadline-engine tables. Never prints the connection string.
 *
 *   --dry-run   run everything, print the after-state, then ROLL BACK.
 *   --rollback  run the rollback SQL instead of the migration (see the file header:
 *               only valid together with an application revision rollback).
 *
 * Required env: RLS_ENFORCEMENT_ADMIN_DATABASE_URL (or RLS_MIGRATION_ADMIN_DATABASE_URL /
 * ADMIN_DATABASE_URL) — the migration-admin principal, never the runtime role.
 */
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import postgres from 'postgres'

export const DEADLINE_ENGINE_RLS_TABLES = [
  'deadline_audit_events',
  'deadline_reminder_executions',
  'deadline_reminders',
] as const

export interface DeadlineTableState {
  tbl: string
  rls: boolean
  force: boolean
  runtimePolicy: boolean
  systemPolicy: boolean
  publicPolicy: boolean
}

export function isFailClosed(rows: readonly DeadlineTableState[]): boolean {
  return (
    rows.length === DEADLINE_ENGINE_RLS_TABLES.length &&
    rows.every((r) => r.rls && r.force && r.runtimePolicy && r.systemPolicy && !r.publicPolicy)
  )
}

export function isLegacyRestored(rows: readonly DeadlineTableState[]): boolean {
  return rows.length === DEADLINE_ENGINE_RLS_TABLES.length && rows.every((r) => r.rls && r.publicPolicy)
}

class DryRunRollback extends Error {}

async function snapshot(sql: postgres.Sql): Promise<DeadlineTableState[]> {
  const tables = [...DEADLINE_ENGINE_RLS_TABLES]
  const rows = await sql<DeadlineTableState[]>`
    SELECT c.relname AS tbl,
           c.relrowsecurity AS rls,
           c.relforcerowsecurity AS force,
           EXISTS (SELECT 1 FROM pg_policy p WHERE p.polrelid = c.oid AND 'union_eyes_runtime'::regrole = ANY (p.polroles)) AS "runtimePolicy",
           EXISTS (SELECT 1 FROM pg_policy p WHERE p.polrelid = c.oid AND 'union_eyes_system'::regrole = ANY (p.polroles)) AS "systemPolicy",
           EXISTS (SELECT 1 FROM pg_policy p WHERE p.polrelid = c.oid AND 0::oid = ANY (p.polroles)) AS "publicPolicy"
    FROM pg_class c
    WHERE c.relnamespace = 'public'::regnamespace AND c.relkind = 'r' AND c.relname = ANY(${tables})
    ORDER BY c.relname`
  return [...rows]
}

function print(label: string, rows: readonly DeadlineTableState[]) {
  console.log(`\n${label}`)
  for (const r of rows) {
    console.log(
      `  ${r.tbl.padEnd(32)} rls=${r.rls} force=${r.force} runtimePolicy=${r.runtimePolicy} systemPolicy=${r.systemPolicy} publicPolicy=${r.publicPolicy}`,
    )
  }
}

async function main() {
  const args = process.argv.slice(2)
  const dryRun = args.includes('--dry-run')
  const rollback = args.includes('--rollback')
  const url =
    process.env.RLS_ENFORCEMENT_ADMIN_DATABASE_URL ||
    process.env.RLS_MIGRATION_ADMIN_DATABASE_URL ||
    process.env.ADMIN_DATABASE_URL
  if (!url) {
    console.error('[deadline-rls] Missing RLS_ENFORCEMENT_ADMIN_DATABASE_URL / RLS_MIGRATION_ADMIN_DATABASE_URL / ADMIN_DATABASE_URL.')
    process.exit(1)
  }

  const file = rollback
    ? '20261018_deadline_engine_rls_fail_closed_closure_rollback.sql'
    : '20261018_deadline_engine_rls_fail_closed_closure.sql'
  const text = readFileSync(join(__dirname, '..', 'db', 'migrations', file), 'utf8')
  console.log(`[deadline-rls] file=${file} sha256=${createHash('sha256').update(text).digest('hex')} mode=${rollback ? 'rollback' : 'apply'}${dryRun ? ' (dry-run, will roll back)' : ''}`)

  const sql = postgres(url, { ssl: url.includes('localhost') ? false : 'require', max: 1, prepare: false, onnotice: () => undefined })
  try {
    const who = await sql<{ cu: string }[]>`SELECT current_user AS cu`
    console.log(`[deadline-rls] connected as ${who[0].cu}`)

    try {
      await sql.begin(async (tx) => {
        print('BEFORE', await snapshot(tx as unknown as postgres.Sql))
        await tx.unsafe(text)
        const after = await snapshot(tx as unknown as postgres.Sql)
        print('AFTER', after)
        const ok = rollback ? isLegacyRestored(after) : isFailClosed(after)
        if (!ok) throw new Error('post-state assertion failed; transaction rolled back')
        if (dryRun) throw new DryRunRollback('dry-run: rolling back')
      })
    } catch (err) {
      if (err instanceof DryRunRollback) {
        console.log('\n[deadline-rls] DRY-RUN OK — assertions passed, transaction rolled back, no change persisted.')
        return
      }
      throw err
    }
    console.log(`\n[deadline-rls] ${rollback ? 'ROLLBACK' : 'APPLY'} committed. 3/3 tables verified in-transaction.`)
  } finally {
    await sql.end({ timeout: 2 })
  }
}

if (process.argv[1]?.replace(/\\/g, '/').endsWith('/scripts/apply-deadline-engine-rls-closure.ts')) {
  main().catch((err) => {
    console.error('[deadline-rls] FAILED:', err instanceof Error ? err.message : err)
    process.exit(1)
  })
}
