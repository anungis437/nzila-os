#!/usr/bin/env node
/**
 * PostgreSQL proof for the forward-only DAPL enum upgrade.
 * Uses a local superuser socket. Drops only the databases it creates.
 */

import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import pg from 'pg'
import { applyPlatformMigrations, computeMigrationHash } from './lib/union-eyes-platform-migrations.mjs'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const platformDir = path.join(repoRoot, 'apps/union-eyes/db/migrations-platform')
const migrationPath = path.join(platformDir, '0008_dapl_enum_label_evolution.sql')
const migrationSql = fs.readFileSync(migrationPath, 'utf8')
const frozenSql = fs.readFileSync(
  path.join(repoRoot, 'apps/union-eyes/db/migrations/20260325_dapl_platform_ledger.sql'),
  'utf8',
)
const canonicalSql = fs.readFileSync(
  path.join(platformDir, '0009_canonical_lineage_relations.sql'),
  'utf8',
)

const TYPES = ['platform_cost_type', 'ledger_event_type', 'ledger_source_type']
const evidence = []

function record(name, detail) {
  evidence.push({ name, ...detail })
  process.stdout.write(`${name} ${JSON.stringify(detail)}\n`)
}

function enumCreates(sql) {
  const creates = new Map()
  const pattern = /CREATE TYPE\s+(?:"public"\.)?"?([a-z0-9_]+)"?\s+AS ENUM\s*\(([^;]*?)\)/gis
  for (const match of sql.matchAll(pattern)) {
    creates.set(match[1], match[0].replace(/"public"\./, '').replaceAll('"', ''))
  }
  return creates
}

const historicalCreates = enumCreates(frozenSql)
const canonicalChecks = canonicalSql
  .split('--> statement-breakpoint')
  .map((statement) => statement.trim())
  .filter((statement) => TYPES.some((typeName) => statement.includes(`incompatible existing type public.${typeName}`)))

function adminQuery(sql) {
  const result = spawnSync('sudo', ['-u', 'postgres', 'psql', '-v', 'ON_ERROR_STOP=1', '-d', 'postgres', '-c', sql], {
    encoding: 'utf8',
  })
  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || `admin query failed: ${sql}`)
  }
}

function clientFor(database) {
  const url = new URL(process.env.DATABASE_URL)
  url.pathname = `/${database}`
  return new pg.Client({ connectionString: url.toString() })
}

async function withDatabase(name, run) {
  adminQuery(`DROP DATABASE IF EXISTS ${name}`)
  adminQuery(`CREATE DATABASE ${name}`)
  const client = clientFor(name)
  await client.connect()
  try {
    return await run(client)
  } finally {
    await client.end()
  }
}

async function labels(client, typeName) {
  const result = await client.query(
    `SELECT COALESCE(array_agg(e.enumlabel::text ORDER BY e.enumsortorder), ARRAY[]::text[]) AS labels
     FROM pg_type t
     JOIN pg_namespace n ON n.oid = t.typnamespace
     JOIN pg_enum e ON e.enumtypid = t.oid
     WHERE n.nspname = 'public' AND t.typname = $1`,
    [typeName],
  )
  return result.rows[0].labels
}

async function installHistorical(client, mutate) {
  for (const typeName of TYPES) {
    let statement = historicalCreates.get(typeName)
    if (mutate) statement = mutate(typeName, statement)
    await client.query(statement)
  }
}

async function applyEvolution(client) {
  await client.query('BEGIN')
  try {
    await client.query(migrationSql)
    await client.query('COMMIT')
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  }
}

async function canonicalEnumChecks(client) {
  for (const statement of canonicalChecks) {
    await client.query(statement)
  }
}

const expected = {
  platform_cost_type: ['base_subscription', 'local_fee', 'seat_fee', 'module_fee', 'usage_fee', 'onboarding_fee', 'support_fee', 'transaction_fee', 'settlement', 'adjustment', 'credit', 'subsidy', 'writeoff'],
  ledger_event_type: ['invoice_generated', 'payment_received', 'allocation_run', 'adjustment_posted', 'credit_applied', 'subsidy_applied', 'writeoff_posted', 'period_closed', 'reversal', 'fee_captured', 'settlement_closed'],
  ledger_source_type: ['subscription', 'invoice', 'payment', 'adjustment', 'allocation', 'manual', 'system', 'transaction_fee', 'settlement_batch'],
}

try {
  await withDatabase('ue_dapl_enum_fresh', async (client) => {
    await applyEvolution(client)
    const before = {}
    for (const typeName of TYPES) before[typeName] = await labels(client, typeName)
    await canonicalEnumChecks(client)
    const after = {}
    for (const typeName of TYPES) after[typeName] = await labels(client, typeName)
    record('fresh_installation', { before, after })
    for (const typeName of TYPES) {
      if (JSON.stringify(after[typeName]) !== JSON.stringify(expected[typeName])) {
        throw new Error(`fresh ${typeName} ${after[typeName]}`)
      }
    }
  })

  await withDatabase('ue_dapl_enum_historical', async (client) => {
    await installHistorical(client)
    const before = {}
    for (const typeName of TYPES) before[typeName] = await labels(client, typeName)
    await client.query(`
      CREATE TABLE public.platform_cost_ledger_entries (
        id uuid PRIMARY KEY,
        cost_type platform_cost_type NOT NULL,
        event_type ledger_event_type NOT NULL,
        source_type ledger_source_type NOT NULL,
        amount numeric NOT NULL
      )
    `)
    await client.query(`
      INSERT INTO public.platform_cost_ledger_entries (id, cost_type, event_type, source_type, amount)
      VALUES ('11111111-1111-4111-8111-111111111111', 'adjustment', 'reversal', 'system', 12.50)
    `)
    await client.query('BEGIN')
    await client.query(migrationSql)
    await client.query('ROLLBACK')
    const rolledBack = {}
    for (const typeName of TYPES) rolledBack[typeName] = await labels(client, typeName)
    const preservedDuringRollback = await client.query(
      `SELECT cost_type::text, event_type::text, source_type::text, amount::text
       FROM public.platform_cost_ledger_entries`,
    )
    await applyEvolution(client)
    const after = {}
    for (const typeName of TYPES) after[typeName] = await labels(client, typeName)
    await applyEvolution(client)
    const repeated = {}
    for (const typeName of TYPES) repeated[typeName] = await labels(client, typeName)
    await canonicalEnumChecks(client)
    const row = await client.query(
      `SELECT cost_type::text, event_type::text, source_type::text, amount::text
       FROM public.platform_cost_ledger_entries`,
    )
    record('historical_upgrade', { before, rolledBack, after, repeated, row: row.rows[0], rollbackRow: preservedDuringRollback.rows[0] })
    for (const typeName of TYPES) {
      if (JSON.stringify(rolledBack[typeName]) !== JSON.stringify(before[typeName])) {
        throw new Error(`rollback changed ${typeName}`)
      }
      if (JSON.stringify(after[typeName]) !== JSON.stringify(expected[typeName])) {
        throw new Error(`upgraded ${typeName} ${after[typeName]}`)
      }
      if (JSON.stringify(repeated[typeName]) !== JSON.stringify(after[typeName])) {
        throw new Error(`repeat changed ${typeName}`)
      }
      for (const label of before[typeName]) {
        if (!after[typeName].includes(label)) throw new Error(`lost historical label ${typeName}.${label}`)
      }
    }
    const stored = row.rows[0]
    if (stored.cost_type !== 'adjustment' || stored.event_type !== 'reversal' || stored.source_type !== 'system' || stored.amount !== '12.50') {
      throw new Error(`stored financial meaning changed ${JSON.stringify(stored)}`)
    }
  })

  await withDatabase('ue_dapl_enum_incompatible', async (client) => {
    await installHistorical(client, (typeName, statement) => {
      if (typeName === 'platform_cost_type') return statement.replace(/\)\s*$/, ",'rogue_fee')")
      return statement
    })
    const before = await labels(client, 'platform_cost_type')
    let refused = false
    let message = ''
    try {
      await applyEvolution(client)
    } catch (error) {
      refused = /incompatible existing type public.platform_cost_type/.test(error.message)
      message = error.message
    }
    const after = await labels(client, 'platform_cost_type')
    record('incompatible_extra_label', { refused, message, before, after })
    if (!refused || JSON.stringify(after) !== JSON.stringify(before)) {
      throw new Error('incompatible enum was changed or admitted')
    }
  })

  await withDatabase('ue_dapl_enum_reordered', async (client) => {
    await installHistorical(client, (typeName, statement) => {
      if (typeName === 'ledger_source_type') return statement.replace("'manual','system'", "'system','manual'")
      return statement
    })
    const before = await labels(client, 'ledger_source_type')
    let refused = false
    try {
      await applyEvolution(client)
    } catch (error) {
      refused = /incompatible existing type public.ledger_source_type/.test(error.message)
    }
    const after = await labels(client, 'ledger_source_type')
    record('incompatible_order', { refused, before, after })
    if (!refused || JSON.stringify(after) !== JSON.stringify(before)) {
      throw new Error('reordered enum was changed or admitted')
    }
  })

  await withDatabase('ue_dapl_enum_ledger', async (client) => {
    await installHistorical(client)
    await client.query('CREATE SCHEMA drizzle')
    await client.query(`
      CREATE TABLE drizzle.__drizzle_migrations (
        id serial PRIMARY KEY,
        hash text NOT NULL,
        created_at bigint
      )
    `)
    const journalPath = path.join(platformDir, 'meta/_journal.json')
    const journal = JSON.parse(fs.readFileSync(journalPath, 'utf8'))
    for (const entry of journal.entries) {
      if (entry.tag === '0008_dapl_enum_label_evolution') continue
      const { hash } = computeMigrationHash(platformDir, entry.tag)
      await client.query('INSERT INTO drizzle.__drizzle_migrations (hash, created_at) VALUES ($1, $2)', [hash, entry.when])
    }
    const first = await applyPlatformMigrations(client, { journalPath, migrationsDir: platformDir })
    const second = await applyPlatformMigrations(client, { journalPath, migrationsDir: platformDir })
    const recorded = await client.query(
      `SELECT count(*)::int AS n FROM drizzle.__drizzle_migrations WHERE hash = $1`,
      [computeMigrationHash(platformDir, '0008_dapl_enum_label_evolution').hash],
    )
    const after = {}
    for (const typeName of TYPES) after[typeName] = await labels(client, typeName)
    record('migration_ledger', { first, second, recorded: recorded.rows[0].n, after })
    if (first.applied !== 1 || !first.appliedTags.includes('0008_dapl_enum_label_evolution')) {
      throw new Error(`runner applied ${JSON.stringify(first)}`)
    }
    if (second.applied !== 0 || recorded.rows[0].n !== 1) {
      throw new Error('enum migration ledger was not idempotent')
    }
    for (const typeName of TYPES) {
      if (JSON.stringify(after[typeName]) !== JSON.stringify(expected[typeName])) {
        throw new Error(`runner left ${typeName} at ${after[typeName]}`)
      }
    }
  })

  record('enum_proof_complete', { ok: true })
} finally {
  fs.writeFileSync('/tmp/ue-dapl-enum-evidence.json', JSON.stringify(evidence, null, 2))
}
