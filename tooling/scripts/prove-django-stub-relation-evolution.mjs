#!/usr/bin/env node
/**
 * PostgreSQL proof for empty Django stub relation evolution.
 * Uses a local superuser socket. Drops only the databases it creates.
 */

import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import pg from 'pg'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const platformDir = path.join(repoRoot, 'apps/union-eyes/db/migrations-platform')
const migrationSql = fs.readFileSync(
  path.join(platformDir, '0008_django_stub_relation_evolution.sql'),
  'utf8',
)
const canonicalSql = fs.readFileSync(
  path.join(platformDir, '0009_canonical_lineage_relations.sql'),
  'utf8',
)

const RELATIONS = [
  'employers',
  'worksites',
  'bargaining_units',
  'committees',
  'collective_agreements',
  'cba_clauses',
  'cost_centers',
]
const EXPECTED = {
  employers: 33,
  worksites: 22,
  bargaining_units: 27,
  committees: 29,
  collective_agreements: 37,
  cba_clauses: 24,
  cost_centers: 19,
}

const evidence = []

function record(name, detail) {
  evidence.push({ name, ...detail })
  process.stdout.write(`${name} ${JSON.stringify(detail)}\n`)
}

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

async function installParents(client) {
  await client.query(`CREATE TABLE public.organizations (id uuid PRIMARY KEY)`)
  await client.query(`CREATE TABLE public.profiles (user_id text PRIMARY KEY)`)
}

function stubDdl(table) {
  const extra = table === 'collective_agreements'
    ? ',\n    cba_number varchar(255)'
    : ''
  return `
    CREATE TABLE public.${table} (
      id uuid PRIMARY KEY,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      organization_id uuid${extra}
    )
  `
}

async function installStubs(client) {
  await installParents(client)
  for (const table of RELATIONS) {
    await client.query(stubDdl(table))
  }
}

async function columnNames(client, table) {
  const result = await client.query(
    `SELECT COALESCE(array_agg(a.attname::text ORDER BY a.attname), ARRAY[]::text[]) AS names
     FROM pg_attribute a
     WHERE a.attrelid = $1::regclass AND a.attnum > 0 AND NOT a.attisdropped`,
    [`public.${table}`],
  )
  return result.rows[0].names
}

async function canonicalMatches(client) {
  const matches = {}
  await client.query('BEGIN')
  await client.query(
    'CREATE TEMP TABLE IF NOT EXISTS ue_bootstrap_created_relations (relname text PRIMARY KEY) ON COMMIT DROP',
  )
  const statements = canonicalSql.split('--> statement-breakpoint').map((statement) => statement.trim()).filter(Boolean)
  for (const table of RELATIONS) {
    const columnCheck = statements.find((statement) =>
      statement.includes(`incompatible existing relation public.${table}: expected ${EXPECTED[table]} matching columns`),
    )
    if (!columnCheck) throw new Error(`missing 0009 column check for ${table}`)
    await client.query(columnCheck)
    const fkChecks = statements.filter((statement) =>
      statement.includes(`incompatible existing relation public.${table}: constraint`),
    )
    for (const statement of fkChecks) {
      await client.query(statement)
    }
    const found = await client.query(
      `SELECT count(*)::int AS found
       FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = $1
         AND column_name = ANY($2::text[])`,
      [table, (await columnNames(client, table))],
    )
    matches[table] = found.rows[0].found
  }
  await client.query('COMMIT')
  return matches
}

try {
  await withDatabase('ue_stub_rel_empty', async (client) => {
    await installStubs(client)
    await client.query('BEGIN')
    await client.query(migrationSql)
    await client.query('ROLLBACK')
    const rolledBack = await columnNames(client, 'employers')
    await applyEvolution(client)
    await applyEvolution(client)
    const matches = await canonicalMatches(client)
    const names = {}
    for (const table of RELATIONS) names[table] = (await columnNames(client, table)).length
    record('empty_stubs', { rolledBack, names, matches })
    if (JSON.stringify(rolledBack) !== JSON.stringify(['created_at', 'id', 'organization_id', 'updated_at'])) {
      throw new Error(`rollback changed employers ${rolledBack}`)
    }
    for (const table of RELATIONS) {
      if (matches[table] < EXPECTED[table]) {
        throw new Error(`${table} canonical check saw ${matches[table]} columns, expected at least ${EXPECTED[table]}`)
      }
    }
  })

  await withDatabase('ue_stub_rel_populated', async (client) => {
    await installStubs(client)
    await client.query(`INSERT INTO public.employers (id) VALUES ('11111111-1111-4111-8111-111111111111')`)
    let message = ''
    try {
      await applyEvolution(client)
    } catch (error) {
      message = error.message
    }
    const names = await columnNames(client, 'employers')
    const nullable = await client.query(
      `SELECT is_nullable FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'employers' AND column_name = 'organization_id'`,
    )
    record('populated_stub', { message, names, organizationNullable: nullable.rows[0].is_nullable })
    if (!message.includes('populated row(s)') || !message.includes('Rows were not rewritten')) {
      throw new Error(`populated stub did not fail closed: ${message}`)
    }
    if (JSON.stringify(names) !== JSON.stringify(['created_at', 'id', 'organization_id', 'updated_at'])) {
      throw new Error(`populated employers changed ${names}`)
    }
    if (nullable.rows[0].is_nullable !== 'YES') {
      throw new Error('populated organization_id nullability changed')
    }
  })

  await withDatabase('ue_stub_rel_unrecognized', async (client) => {
    await client.query(`
      CREATE TABLE public.employers (
        id uuid PRIMARY KEY,
        org_id uuid NOT NULL,
        name varchar(500) NOT NULL,
        industry varchar(255),
        contact_email varchar(320),
        contact_phone varchar(30),
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )
    `)
    let message = ''
    try {
      await applyEvolution(client)
    } catch (error) {
      message = error.message
    }
    const names = await columnNames(client, 'employers')
    record('unrecognized_shape', { message, names })
    if (!message.includes('unrecognized historical columns') || !message.includes('Rows were not rewritten')) {
      throw new Error(`unrecognized shape did not fail closed: ${message}`)
    }
    if (!names.includes('org_id') || names.includes('organization_id')) {
      throw new Error(`unrecognized employers changed ${names}`)
    }
  })

  await withDatabase('ue_stub_rel_enum', async (client) => {
    await installStubs(client)
    await client.query(`CREATE TYPE public.employer_type AS ENUM ('private')`)
    let message = ''
    try {
      await applyEvolution(client)
    } catch (error) {
      message = error.message
    }
    const names = await columnNames(client, 'employers')
    record('incompatible_enum', { message, names })
    if (!message.includes('incompatible existing type public.employer_type')) {
      throw new Error(`enum mismatch did not fail closed: ${message}`)
    }
    if (JSON.stringify(names) !== JSON.stringify(['created_at', 'id', 'organization_id', 'updated_at'])) {
      throw new Error(`enum mismatch changed employers ${names}`)
    }
  })

  await withDatabase('ue_stub_rel_cba_id', async (client) => {
    await installStubs(client)
    await client.query('DROP TABLE public.cba_clauses')
    await client.query(`
      CREATE TABLE public.cba_clauses (
        id uuid PRIMARY KEY,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        organization_id uuid,
        cba_id uuid
      )
    `)
    await client.query(`INSERT INTO public.cba_clauses (id) VALUES ('22222222-2222-4222-8222-222222222222')`)
    let populatedMessage = ''
    try {
      await applyEvolution(client)
    } catch (error) {
      populatedMessage = error.message
    }
    const populatedNames = await columnNames(client, 'cba_clauses')
    await client.query('DELETE FROM public.cba_clauses')
    await applyEvolution(client)
    const matches = await canonicalMatches(client)
    record('cba_id_subset', {
      populatedMessage,
      populatedNames,
      emptyColumns: matches.cba_clauses,
    })
    if (!populatedMessage.includes('Rows were not rewritten')) {
      throw new Error(`populated cba_clauses did not fail closed: ${populatedMessage}`)
    }
    if (JSON.stringify(populatedNames) !== JSON.stringify(['cba_id', 'created_at', 'id', 'organization_id', 'updated_at'])) {
      throw new Error(`populated cba_clauses changed ${populatedNames}`)
    }
    if (matches.cba_clauses < EXPECTED.cba_clauses) {
      throw new Error(`empty cba_id subset did not satisfy 0009: ${matches.cba_clauses}`)
    }
  })

  await withDatabase('ue_stub_rel_access', async (client) => {
    await client.query(`CREATE TYPE public.case_access_role AS ENUM ('secondary_lro')`)
    await client.query(`CREATE TYPE public.case_access_status AS ENUM ('active')`)
    await client.query(`CREATE TABLE public.grievances (id uuid PRIMARY KEY)`)
    const grievanceId = '33333333-3333-4333-8333-333333333333'
    const userId = '11111111-1111-4111-8111-111111111111'
    await client.query(`INSERT INTO public.grievances (id) VALUES ($1)`, [grievanceId])
    await client.query(`
      CREATE TABLE public.grievance_case_access_assignments (
        id uuid PRIMARY KEY,
        organization_id uuid NOT NULL,
        grievance_id uuid NOT NULL REFERENCES public.grievances(id) ON DELETE CASCADE,
        user_id uuid NOT NULL,
        access_role public.case_access_role NOT NULL,
        granted_by uuid NOT NULL,
        granted_at timestamptz NOT NULL DEFAULT now(),
        expires_at timestamptz,
        can_comment boolean NOT NULL DEFAULT true,
        can_upload_documents boolean NOT NULL DEFAULT false,
        can_edit_case_notes boolean NOT NULL DEFAULT false,
        can_draft_actions boolean NOT NULL DEFAULT false,
        can_view_private_documents boolean NOT NULL DEFAULT false,
        status public.case_access_status NOT NULL,
        updated_at timestamptz NOT NULL DEFAULT now()
      )
    `)
    await client.query(
      `INSERT INTO public.grievance_case_access_assignments (
         id, organization_id, grievance_id, user_id, access_role, granted_by, status
       ) VALUES ($1, $1, $2, $3, 'secondary_lro', $3, 'active')`,
      [grievanceId, grievanceId, userId],
    )
    await applyEvolution(client)
    const row = await client.query(
      `SELECT user_id, pg_typeof(user_id)::text AS user_type, granted_by, pg_typeof(granted_by)::text AS granted_type
       FROM public.grievance_case_access_assignments`,
    )
    const statements = canonicalSql.split('--> statement-breakpoint').map((statement) => statement.trim()).filter(Boolean)
    const columnCheck = statements.find((statement) =>
      statement.includes('incompatible existing relation public.grievance_case_access_assignments: expected 15 matching columns'),
    )
    await client.query('BEGIN')
    await client.query('CREATE TEMP TABLE IF NOT EXISTS ue_bootstrap_created_relations (relname text PRIMARY KEY) ON COMMIT DROP')
    await client.query(columnCheck)
    const fkCheck = statements.find((statement) =>
      statement.includes('constraint grievance_case_access_assignments_grievance_id_grievances_id_fk is absent'),
    )
    await client.query(fkCheck)
    await client.query('COMMIT')
    record('access_assignment_uuid_text', row.rows[0])
    if (row.rows[0].user_type !== 'text' || row.rows[0].user_id !== userId) {
      throw new Error(`user_id was not preserved as text: ${JSON.stringify(row.rows[0])}`)
    }
    if (row.rows[0].granted_type !== 'text' || row.rows[0].granted_by !== userId) {
      throw new Error(`granted_by was not preserved as text: ${JSON.stringify(row.rows[0])}`)
    }
  })

  await withDatabase('ue_stub_rel_absent', async (client) => {
    await applyEvolution(client)
    const exists = await client.query(`SELECT to_regclass('public.employers') AS rel`)
    record('absent_relation', { employers: exists.rows[0].rel })
    if (exists.rows[0].rel !== null) {
      throw new Error('absent employers was created by the stub migration')
    }
  })

  const artifact = '/opt/cursor/artifacts/django-stub-relation-evidence.json'
  fs.writeFileSync(artifact, JSON.stringify(evidence, null, 2))
  process.stdout.write(`evidence ${artifact}\n`)
} catch (error) {
  console.error(error)
  process.exit(1)
}
