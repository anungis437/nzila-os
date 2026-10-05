#!/usr/bin/env tsx
/**
 * apply-prod-rls-closure-twelve-tables.ts — CHG-2026-0110.
 *
 * Applies (or rolls back) db/migrations/20261005_prod_rls_closure_twelve_tables.sql
 * in ONE transaction, printing the SHA-256 of the SQL and a before/after state
 * table for the 12 tables. Never prints the connection string.
 *
 *   --dry-run   run everything, print the after-state, then ROLL BACK.
 *   --rollback  run the rollback SQL instead of the migration.
 *
 * Required env: RLS_ENFORCEMENT_ADMIN_DATABASE_URL (or RLS_MIGRATION_ADMIN_DATABASE_URL /
 * ADMIN_DATABASE_URL) — the migration-admin principal, never the runtime role.
 */
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import postgres from 'postgres'

export const RLS_CLOSURE_TABLES = [
  'workbooks',
  'workbook_modules',
  'workbook_purchases',
  'workbook_memory_holders',
  'workbook_governance_lineage_entries',
  'audit_logs',
  'organization_users',
  'compliance_snapshots',
  'domain_events',
  'evidence_packs',
  'integration_idempotency_keys',
  'integration_registry',
] as const

export interface TableState {
  tbl: string
  rls: boolean
  force: boolean
  policies: number
  runtimePolicy: boolean
  systemPolicy: boolean
}

export function isFullyEnforced(rows: readonly TableState[]): boolean {
  return (
    rows.length === RLS_CLOSURE_TABLES.length &&
    rows.every((r) => r.rls && r.force && r.runtimePolicy && r.systemPolicy)
  )
}

export function isUnenforced(rows: readonly TableState[]): boolean {
  return rows.length === RLS_CLOSURE_TABLES.length && rows.every((r) => !r.rls && !r.force && r.policies === 0)
}

class DryRunRollback extends Error {}

async function snapshot(sql: postgres.Sql | postgres.TransactionSql): Promise<TableState[]> {
  const tables = [...RLS_CLOSURE_TABLES]
  const rows = await sql<TableState[]>`
    SELECT c.relname AS tbl,
           c.relrowsecurity AS rls,
           c.relforcerowsecurity AS force,
           (SELECT count(*) FROM pg_policy p WHERE p.polrelid = c.oid)::int AS policies,
           EXISTS (SELECT 1 FROM pg_policy p WHERE p.polrelid = c.oid AND 'union_eyes_runtime'::regrole = ANY (p.polroles)) AS "runtimePolicy",
           EXISTS (SELECT 1 FROM pg_policy p WHERE p.polrelid = c.oid AND 'union_eyes_system'::regrole = ANY (p.polroles)) AS "systemPolicy"
    FROM pg_class c
    WHERE c.relnamespace = 'public'::regnamespace AND c.relkind = 'r' AND c.relname = ANY(${tables})
    ORDER BY c.relname`
  return [...rows]
}

function print(label: string, rows: readonly TableState[]) {
  console.log(`\n${label}`)
  for (const r of rows) {
    console.log(`  ${r.tbl.padEnd(38)} rls=${r.rls} force=${r.force} policies=${r.policies} runtimePolicy=${r.runtimePolicy} systemPolicy=${r.systemPolicy}`)
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
    console.error('[rls-closure] Missing RLS_ENFORCEMENT_ADMIN_DATABASE_URL / RLS_MIGRATION_ADMIN_DATABASE_URL / ADMIN_DATABASE_URL.')
    process.exit(1)
  }

  const file = rollback
    ? '20261005_prod_rls_closure_twelve_tables_rollback.sql'
    : '20261005_prod_rls_closure_twelve_tables.sql'
  const text = readFileSync(join(__dirname, '..', 'db', 'migrations', file), 'utf8')
  console.log(`[rls-closure] file=${file} sha256=${createHash('sha256').update(text).digest('hex')} mode=${rollback ? 'rollback' : 'apply'}${dryRun ? ' (dry-run, will roll back)' : ''}`)

  const sql = postgres(url, { ssl: url.includes('localhost') ? false : 'require', max: 1, prepare: false, onnotice: () => undefined })
  try {
    const who = await sql<{ cu: string; super: boolean; bypass: boolean }[]>`
      SELECT current_user AS cu, r.rolsuper AS super, r.rolbypassrls AS bypass FROM pg_roles r WHERE r.rolname = current_user`
    console.log(`[rls-closure] connected as ${who[0].cu} (rolsuper=${who[0].super}, rolbypassrls=${who[0].bypass})`)

    let after: TableState[] = []
    try {
      await sql.begin(async (tx) => {
        const before = await snapshot(tx)
        print('BEFORE', before)
        await tx.unsafe(text)
        after = await snapshot(tx)
        print('AFTER', after)
        const ok = rollback ? isUnenforced(after) : isFullyEnforced(after)
        if (!ok) throw new Error('post-state assertion failed; transaction rolled back')
        if (dryRun) throw new DryRunRollback('dry-run: rolling back')
      })
    } catch (err) {
      if (err instanceof DryRunRollback) {
        console.log('\n[rls-closure] DRY-RUN OK — assertions passed, transaction rolled back, no change persisted.')
        return
      }
      throw err
    }
    console.log(`\n[rls-closure] ${rollback ? 'ROLLBACK' : 'APPLY'} committed. 12/12 tables verified in-transaction.`)
  } finally {
    await sql.end({ timeout: 2 })
  }
}

if (process.argv[1]?.replace(/\\/g, '/').endsWith('/scripts/apply-prod-rls-closure-twelve-tables.ts')) {
  main().catch((err) => {
    console.error('[rls-closure] FAILED:', err instanceof Error ? err.message : err)
    process.exit(1)
  })
}
