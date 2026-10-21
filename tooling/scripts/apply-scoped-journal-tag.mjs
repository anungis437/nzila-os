#!/usr/bin/env node
/**
 * Apply one scoped journal tag through the shared scoped executor.
 *
 * This entry point only runs 0019_deadline_reassignment_convergence, and
 * only after a deployment-safety decision has allowed phase scoped-0019.
 * It does not connect to Postgres when the candidate file or the decision
 * is missing.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { MIGRATION_0019_TAG } from './lib/union-eyes-deployment-safety.mjs'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const migrationsDir = path.join(repoRoot, 'apps', 'union-eyes', 'db', 'migrations-cache')
const journalPath = path.join(migrationsDir, 'meta', '_journal.json')

function arg(name) {
  const index = process.argv.indexOf(name)
  return index >= 0 ? process.argv[index + 1] : undefined
}

const decisionPath = arg('--decision')
const tag = arg('--tag')
if (tag !== MIGRATION_0019_TAG || !decisionPath) {
  process.stderr.write('scoped executor requires --tag 0019_deadline_reassignment_convergence and --decision <allowed-decision.json>\n')
  process.exit(2)
}

const sqlPath = path.join(migrationsDir, `${MIGRATION_0019_TAG}.sql`)
if (!fs.existsSync(sqlPath)) {
  process.stderr.write('MIGRATION_0019_ABSENT_FROM_CANDIDATE\n')
  process.exit(1)
}

const decision = JSON.parse(fs.readFileSync(decisionPath, 'utf8'))
if (decision.phase !== 'scoped-0019' || decision.allowed !== true) {
  process.stderr.write('SCOPED_0019_DECISION_REFUSED\n')
  process.exit(1)
}

const connectionString = process.env.RLS_MIGRATION_ADMIN_DATABASE_URL || process.env.ADMIN_DATABASE_URL
if (!connectionString) {
  process.stderr.write('RLS_MIGRATION_ADMIN_DATABASE_URL is required\n')
  process.exit(1)
}

const { default: pg } = await import('pg')
const { applyScopedMigrations } = await import('./lib/union-eyes-scoped-migrations.mjs')
const client = new pg.Client({ connectionString })
await client.connect()
try {
  await applyScopedMigrations(client, { journalPath, migrationsDir, onlyTags: [MIGRATION_0019_TAG] })
} finally {
  await client.end()
}
