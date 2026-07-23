#!/usr/bin/env tsx
/**
 * Phase 0C.1 §7 — live integration proof for allocate-db + drop-db.
 *
 * Runs against localhost:5433 as the `nzila` role. Writes a run summary
 * to reports/audits/cupe-national-phase-0/phase-0c/phase-0c-database-fixture-proof.md.
 *
 * Usage:
 *   pnpm --filter @nzila/union-eyes lifecycle:prove-db
 */

import { Client } from 'pg'
import fs from 'node:fs'
import path from 'node:path'
import {
  _formatAllocationSummary,
  allocateDatabase,
  dropDatabase,
  type AllocateResult,
} from './allocate-db'

const repoRoot = path.resolve(__dirname, '..', '..', '..', '..')

process.env.NODE_ENV = 'test'
process.env.E2E_DB_ADMIN_URL =
  process.env.E2E_DB_ADMIN_URL ?? 'postgresql://nzila:nzila_dev@localhost:5433/postgres'

const startedAt = new Date().toISOString()
const log: string[] = []
function record(msg: string): void {
  const line = `[${new Date().toISOString()}] ${msg}`
  // eslint-disable-next-line no-console
  console.log(line)
  log.push(line)
}

async function main(): Promise<void> {
  let alloc: AllocateResult | null = null
  try {
    record('Step 1 — allocateDatabase(skipMigrations=true) proves DB creation independent of migration wiring')
    alloc = await allocateDatabase({ skipMigrations: true })
    record(`  → ${_formatAllocationSummary(alloc)}`)

    record('Step 2 — verify DB exists via admin query')
    const admin = new Client({ connectionString: process.env.E2E_DB_ADMIN_URL })
    await admin.connect()
    const { rows } = await admin.query('SELECT datname FROM pg_database WHERE datname = $1', [
      alloc.dbName,
    ])
    await admin.end()
    if (rows.length !== 1) throw new Error(`Expected DB '${alloc.dbName}' to exist; found ${rows.length} rows`)
    record(`  → confirmed DB '${alloc.dbName}' exists`)

    record('Step 3 — connect to the disposable DB and run SELECT 1')
    const disp = new Client({ connectionString: alloc.url })
    await disp.connect()
    const r2 = await disp.query('SELECT 1 AS ok')
    await disp.end()
    if (r2.rows[0].ok !== 1) throw new Error('SELECT 1 did not return 1')
    record('  → SELECT 1 succeeded')

    record('Step 4 — dropDatabase — expected to drop')
    const dropResult = await dropDatabase(alloc)
    if (!dropResult.dropped) throw new Error(`Expected drop; got ${JSON.stringify(dropResult)}`)
    record(`  → drop result: ${JSON.stringify(dropResult)}`)

    record('Step 5 — verify DB no longer exists')
    const admin2 = new Client({ connectionString: process.env.E2E_DB_ADMIN_URL })
    await admin2.connect()
    const r3 = await admin2.query('SELECT datname FROM pg_database WHERE datname = $1', [alloc.dbName])
    await admin2.end()
    if (r3.rows.length !== 0) throw new Error(`Expected DB dropped; still found ${r3.rows.length} rows`)
    record(`  → confirmed DB '${alloc.dbName}' dropped`)

    record('Step 6 — preservation test with E2E_PRESERVE_DB=true')
    process.env.E2E_PRESERVE_DB = 'true'
    const alloc2 = await allocateDatabase({ skipMigrations: true })
    record(`  → allocated ${alloc2.dbName} with preserved=${alloc2.preserved}`)
    const dropResult2 = await dropDatabase(alloc2)
    if (dropResult2.dropped) throw new Error('Preserved DB should not have been dropped')
    record(`  → drop skipped as expected: ${JSON.stringify(dropResult2)}`)

    delete process.env.E2E_PRESERVE_DB
    const forcedDrop = await dropDatabase({ ...alloc2, preserved: false })
    if (!forcedDrop.dropped) throw new Error('Forced cleanup drop failed')
    record(`  → cleanup drop succeeded: ${JSON.stringify(forcedDrop)}`)

    record('Step 7 — assert nzila_automation was never touched (name check)')
    if (alloc.dbName === 'nzila_automation' || alloc2.dbName === 'nzila_automation') {
      throw new Error('DB name collision with developer DB — safeguard failed')
    }
    record('  → no collision with nzila_automation')

    record('ALL STEPS PASSED')

    const outFile = path.join(
      repoRoot,
      'reports',
      'audits',
      'cupe-national-phase-0',
      'phase-0c',
      'phase-0c-database-fixture-proof.md',
    )
    const md = `# Phase 0C.1 §7 — Disposable Database Fixture Proof

**Status:** PASS
**Generated:** ${startedAt} → ${new Date().toISOString()}
**Host:** localhost:5433 (native PG, role \`nzila\`)
**Prover:** \`apps/union-eyes/scripts/lifecycle/prove-db-allocator.ts\`

## What was proven

1. \`allocateDatabase()\` creates a uniquely-named disposable database.
2. The new DB is reachable and accepts \`SELECT 1\`.
3. \`dropDatabase()\` removes the database by default.
4. \`E2E_PRESERVE_DB=true\` prevents drop; forced cleanup still works.
5. \`nzila_automation\` (developer DB) name-collision guard holds.

## Live log

\`\`\`
${log.join('\n')}
\`\`\`

## Notes

- Migrations were **skipped** in this proof (\`skipMigrations: true\`) so the DB-lifecycle contract is validated in isolation from the Drizzle bootstrap orchestrator. Migration application is exercised end-to-end by the governed lifecycle command.
- Independence guarantee — \`nzila_automation\` was neither read from nor written to during any step. Every operation targeted the \`postgres\` admin DB and the run-scoped \`ue_e2e_*\` disposable DBs.

## Lifecycle history

Recorded in \`apps/union-eyes/.e2e-lifecycle/history.jsonl\` (gitignored).
`
    fs.writeFileSync(outFile, md, 'utf8')
    record(`Wrote proof: ${outFile}`)
    process.exit(0)
  } catch (err) {
    record(`FAILED: ${err instanceof Error ? err.stack ?? err.message : String(err)}`)
    if (alloc) {
      try {
        await dropDatabase({ ...alloc, preserved: false })
      } catch {
        /* best effort */
      }
    }
    process.exit(1)
  }
}

void main()
