#!/usr/bin/env node
/**
 * Proves scoped 0019 on a real PostgreSQL the caller already started.
 *
 * Usage: node tooling/scripts/prove-deadline-reassignment-convergence-0019.mjs postgresql://postgres@127.0.0.1:54315/postgres
 *
 * The URL is an admin connection. The script creates and drops its own databases.
 * It does not read DATABASE_URL and it does not connect to staging.
 */
import { createHash } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import pg from 'pg'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const adminUrl = process.argv[2]
if (!adminUrl) {
  process.stderr.write('usage: prove-deadline-reassignment-convergence-0019.mjs <admin-database-url>\n')
  process.exit(2)
}

const SQL_0019 = fs.readFileSync(path.join(repoRoot, 'apps/union-eyes/db/migrations-cache/0019_deadline_reassignment_convergence.sql'), 'utf8')
const SQL_0017 = fs.readFileSync(path.join(repoRoot, 'apps/union-eyes/db/migrations-cache/0017_snapshot_authority_reconciliation.sql'))
const SQL_0049 = fs.readFileSync(path.join(repoRoot, 'migrations/0049_union_eyes_deadline_convergence_tasks.sql'), 'utf8')
const helper = fs.readFileSync(path.join(repoRoot, 'apps/union-eyes/db/migrations-cache/0010_tenant_isolation_rls_foundation.sql'), 'utf8')
  .match(/CREATE OR REPLACE FUNCTION ue_create_direct_org_rls_policy\([\s\S]*?\$\$ LANGUAGE plpgsql;/)?.[0]
if (!helper) throw new Error('ue_create_direct_org_rls_policy not found')

const ORG_A = '00000000-0000-0000-0000-00000000000a'
const ORG_B = '00000000-0000-0000-0000-00000000000b'
const hash0017 = createHash('sha256').update(SQL_0017).digest('hex')
if (SQL_0017.length !== 24003 || hash0017 !== '1b383028f528daa86b079662688d072e9c60ac9e96ce607810449b9148c27f48') {
  throw new Error(`0017 bytes drifted: ${SQL_0017.length} ${hash0017}`)
}

const results = []

function record(name) {
  results.push(name)
  process.stdout.write(`PASS ${name}\n`)
}

async function withDatabase(label, fn) {
  const name = `ue_0019_${label}_${Date.now().toString(36)}`
  const admin = new pg.Client({ connectionString: adminUrl })
  await admin.connect()
  await admin.query(`CREATE DATABASE ${name}`)
  await admin.end()
  const url = new URL(adminUrl)
  url.pathname = `/${name}`
  const client = new pg.Client({ connectionString: url.toString() })
  await client.connect()
  try {
    await fn(client)
  } finally {
    await client.end()
    const drop = new pg.Client({ connectionString: adminUrl })
    await drop.connect()
    await drop.query(`DROP DATABASE ${name}`)
    await drop.end()
  }
}

async function installBase(client) {
  await client.query(`
    DO $roles$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'union_eyes_runtime') THEN
        CREATE ROLE union_eyes_runtime NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS INHERIT NOLOGIN;
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'union_eyes_system') THEN
        CREATE ROLE union_eyes_system NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS INHERIT NOLOGIN;
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'union_eyes_nobody') THEN
        CREATE ROLE union_eyes_nobody NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS INHERIT NOLOGIN;
      END IF;
    END
    $roles$;
    CREATE OR REPLACE FUNCTION ue_set_updated_at() RETURNS trigger AS $fn$
    BEGIN
      NEW.updated_at = now();
      RETURN NEW;
    END;
    $fn$ LANGUAGE plpgsql;
  `)
  await client.query(helper)
}

async function asRole(client, role, org) {
  await client.query('RESET ROLE')
  await client.query(`SET ROLE ${role}`)
  await client.query(`SELECT set_config('app.current_org_id', $1, false)`, [org ?? ''])
}

function statementsOf(sql, marker = '--> statement-breakpoint') {
  return sql.split(marker).map((part) => part.trim()).filter((part) => part.split('\n').some((line) => {
    const trimmed = line.trim()
    return trimmed.length > 0 && !trimmed.startsWith('--')
  }))
}

async function execScript(client, sql, marker = '--> statement-breakpoint') {
  for (const statement of statementsOf(sql, marker)) {
    await client.query(statement)
  }
}

async function expectScriptThrow(client, sql, pattern, marker = '--> statement-breakpoint') {
  let thrown = null
  for (const statement of statementsOf(sql, marker)) {
    try {
      await client.query(statement)
    } catch (error) {
      thrown = error
      break
    }
  }
  if (!thrown) throw new Error(`expected ${pattern} but the script succeeded`)
  if (!pattern.test(thrown.message)) throw new Error(`expected ${pattern}, got ${thrown.message}`)
}

async function expectThrow(client, sql, params, pattern) {
  try {
    await client.query(sql, params)
  } catch (error) {
    if (!pattern.test(error.message)) throw new Error(`expected ${pattern}, got ${error.message}`)
    return
  }
  throw new Error(`expected ${pattern} but the statement succeeded`)
}

async function grants(client, grantee) {
  const rows = await client.query(
    `SELECT privilege_type FROM information_schema.role_table_grants
     WHERE table_schema = 'public' AND table_name = 'deadline_reassignment_convergence' AND grantee = $1
     ORDER BY privilege_type`,
    [grantee],
  )
  return rows.rows.map((row) => row.privilege_type).join(',')
}

const version = await (async () => {
  const client = new pg.Client({ connectionString: adminUrl })
  await client.connect()
  const row = await client.query('SHOW server_version')
  await client.end()
  return row.rows[0].server_version
})()
process.stdout.write(`SERVER ${version}\n`)

await withDatabase('legacy', async (client) => {
  await installBase(client)
  await execScript(client, SQL_0049, ';')
  await client.query(`GRANT SELECT, INSERT, UPDATE ON deadline_reassignment_convergence TO union_eyes_runtime`)
  await client.query('RESET ROLE')
  await client.query(
    `INSERT INTO deadline_reassignment_convergence (organization_id, grievance_id, new_assignee_id, correlation_id)
     VALUES ($1, '10000000-0000-0000-0000-000000000001', 'steward', 'a'), ($2, '10000000-0000-0000-0000-000000000002', 'steward', 'b')`,
    [ORG_A, ORG_B],
  )
  await asRole(client, 'union_eyes_runtime', null)
  const leaked = await client.query('SELECT count(*)::int AS n FROM deadline_reassignment_convergence')
  if (leaked.rows[0].n !== 2) throw new Error(`legacy empty context saw ${leaked.rows[0].n}`)
  await client.query('RESET ROLE')
  await execScript(client, SQL_0019)
  if (await grants(client, 'union_eyes_runtime') !== 'INSERT,SELECT') throw new Error('runtime grants')
  if (await grants(client, 'union_eyes_system') !== 'SELECT,UPDATE') throw new Error('system grants')
  await asRole(client, 'union_eyes_runtime', null)
  const hidden = await client.query('SELECT count(*)::int AS n FROM deadline_reassignment_convergence')
  if (hidden.rows[0].n !== 0) throw new Error('empty context still visible')
  await asRole(client, 'union_eyes_runtime', ORG_A)
  const own = await client.query('SELECT organization_id::text AS organization_id FROM deadline_reassignment_convergence')
  if (own.rows.map((row) => row.organization_id).join() !== ORG_A) throw new Error('tenant A saw another tenant')
  const inserted = await client.query(
    `INSERT INTO deadline_reassignment_convergence (organization_id, grievance_id, new_assignee_id, correlation_id)
     VALUES ($1, '10000000-0000-0000-0000-000000000003', 'steward', 'returning') RETURNING id::text AS id`,
    [ORG_A],
  )
  if (!/^[0-9a-f-]{36}$/.test(inserted.rows[0].id)) throw new Error('RETURNING id missing')
  await expectThrow(
    client,
    `INSERT INTO deadline_reassignment_convergence (organization_id, grievance_id, new_assignee_id, correlation_id)
     VALUES ($1, '10000000-0000-0000-0000-000000000004', 'other', 'forged')`,
    [ORG_B],
    /row-level security/,
  )
  await expectThrow(client, `UPDATE deadline_reassignment_convergence SET attempt_count = 9 WHERE organization_id = $1`, [ORG_A], /permission denied/)
  await expectThrow(client, `UPDATE deadline_reassignment_convergence SET attempt_count = 9 WHERE organization_id = $1`, [ORG_B], /permission denied/)
  await asRole(client, 'union_eyes_system', null)
  const systemSeen = await client.query('SELECT count(*)::int AS n FROM deadline_reassignment_convergence')
  if (systemSeen.rows[0].n !== 3) throw new Error(`system saw ${systemSeen.rows[0].n}`)
  const updated = await client.query(`UPDATE deadline_reassignment_convergence SET attempt_count = attempt_count + 1 WHERE organization_id = $1`, [ORG_B])
  if (updated.rowCount !== 1) throw new Error(`system update count ${updated.rowCount}`)
  await expectThrow(
    client,
    `INSERT INTO deadline_reassignment_convergence (organization_id, grievance_id, new_assignee_id, correlation_id)
     VALUES ($1, '10000000-0000-0000-0000-000000000005', 'system', 'system-insert')`,
    [ORG_A],
    /permission denied/,
  )
  await asRole(client, 'union_eyes_nobody', ORG_A)
  await expectThrow(client, 'SELECT count(*) FROM deadline_reassignment_convergence', [], /permission denied/)
  await client.query('RESET ROLE')
  await execScript(client, SQL_0019)
  const relations = await client.query(
    `SELECT count(*)::int AS n FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'public' AND c.relname = 'deadline_reassignment_convergence' AND c.relkind = 'r'`,
  )
  if (relations.rows[0].n !== 1) throw new Error('partial upgrade created a second table')
  await expectScriptThrow(client, SQL_0049, /canonical closure/, ';')
  const policies = await client.query(`SELECT policyname FROM pg_policies WHERE tablename = 'deadline_reassignment_convergence'`)
  if (policies.rows.some((row) => row.policyname === 'deadline_reassignment_convergence_tenant_isolation')) {
    throw new Error('0049 policy survived replay')
  }
  await expectThrow(
    client,
    `CREATE POLICY deadline_reassignment_convergence_extra ON deadline_reassignment_convergence USING (true)`,
    [],
    /canonical closure/,
  )
  await client.query(`CREATE TABLE ue_unrelated_rls_probe (id int); ALTER TABLE ue_unrelated_rls_probe ENABLE ROW LEVEL SECURITY; CREATE POLICY ue_unrelated_rls_probe_read ON ue_unrelated_rls_probe USING (true);`)
  record(`${version} legacy-0049 partial-upgrade repeat tenant-isolation privilege-minimum 0049-replay`)
})

await withDatabase('fresh', async (client) => {
  await installBase(client)
  await execScript(client, SQL_0019)
  await execScript(client, SQL_0019)
  const guard = await client.query(
    `SELECT evtenabled FROM pg_event_trigger WHERE evtname = 'ue_guard_deadline_reassignment_convergence_policy'`,
  )
  if (guard.rows[0]?.evtenabled !== 'O') throw new Error('policy guard not enabled on fresh apply')
  record(`${version} fresh`)
})

await withDatabase('interrupt', async (client) => {
  await installBase(client)
  const createTable = SQL_0019.split('--> statement-breakpoint').map((part) => part.trim()).filter(Boolean)[2]
  await client.query('BEGIN')
  await client.query(createTable)
  await client.query('ROLLBACK')
  const absent = await client.query(`SELECT to_regclass('public.deadline_reassignment_convergence') AS name`)
  if (absent.rows[0].name !== null) throw new Error('interrupted create remained')
  await execScript(client, SQL_0019)
  record(`${version} interrupted-transaction`)
})

const drifts = [
  ['missing-primary-key', `ALTER TABLE deadline_reassignment_convergence DROP CONSTRAINT deadline_reassignment_convergence_pkey`],
  ['missing-terminal-check', `ALTER TABLE deadline_reassignment_convergence DROP CONSTRAINT deadline_reassignment_convergence_terminal`],
  ['optional-made-mandatory', `ALTER TABLE deadline_reassignment_convergence ALTER COLUMN previous_assignee_id SET NOT NULL`],
  ['extra-column', `ALTER TABLE deadline_reassignment_convergence ADD COLUMN leaked text`],
  ['status-default-removed', `ALTER TABLE deadline_reassignment_convergence ALTER COLUMN status DROP DEFAULT`],
  ['shorter-identifier', `ALTER TABLE deadline_reassignment_convergence ALTER COLUMN new_assignee_id TYPE varchar(32)`],
  ['pending-index-replaced', `DROP INDEX deadline_reassignment_convergence_pending_idx; CREATE INDEX deadline_reassignment_convergence_pending_idx ON deadline_reassignment_convergence (organization_id)`],
]
for (const [label, sql] of drifts) {
  await withDatabase(label.replaceAll('-', '_'), async (client) => {
    await installBase(client)
    await execScript(client, SQL_0049, ';')
    await client.query(sql)
    await expectScriptThrow(client, SQL_0019, /drifted table/)
    const policies = await client.query(`SELECT policyname FROM pg_policies WHERE tablename = 'deadline_reassignment_convergence'`)
    if (!policies.rows.some((row) => row.policyname === 'deadline_reassignment_convergence_tenant_isolation')) {
      throw new Error(`${label} dropped the legacy policy before refusal`)
    }
    if (policies.rows.some((row) => row.policyname === 'ue_org_isolation_select')) {
      throw new Error(`${label} installed a closure policy`)
    }
    record(`${version} drift ${label}`)
  })
}

process.stdout.write(`PROVED ${version} ${results.length} scenarios\n`)
