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

  async function installCommitteeHistory(client, actionStatus) {
    await installStubs(client)
    await client.query('DROP TABLE public.committees')
    await client.query(`
      CREATE TYPE public.committee_type AS ENUM (
        'bargaining', 'grievance', 'health_safety', 'political_action', 'equity', 'education',
        'organizing', 'steward', 'executive', 'finance', 'communications', 'social',
        'pension_benefits', 'other'
      )
    `)
    await client.query(`
      CREATE TABLE public.committees (
        id uuid PRIMARY KEY,
        organization_id uuid NOT NULL,
        name varchar(255) NOT NULL,
        committee_type public.committee_type NOT NULL,
        status varchar(50) DEFAULT 'active' NOT NULL,
        unit_id uuid,
        worksite_id uuid,
        is_organization_wide boolean DEFAULT false,
        mandate text,
        meeting_frequency varchar(100),
        meeting_day varchar(50),
        meeting_time varchar(50),
        meeting_location text,
        max_members integer,
        current_member_count integer DEFAULT 0,
        requires_appointment boolean DEFAULT false,
        requires_election boolean DEFAULT false,
        term_length integer,
        chair_id text,
        secretary_id text,
        contact_email varchar(255),
        description text,
        notes text,
        custom_fields jsonb,
        created_at timestamp with time zone DEFAULT now(),
        updated_at timestamp with time zone DEFAULT now(),
        created_by text,
        updated_by text,
        archived_at timestamp with time zone
      )
    `)
    const orgId = '44444444-4444-4444-8444-444444444444'
    const committeeId = '55555555-5555-4555-8555-555555555555'
    const meetingId = '66666666-6666-4666-8666-666666666666'
    const actionId = '77777777-7777-4777-8777-777777777777'
    await client.query(`INSERT INTO public.organizations (id) VALUES ($1)`, [orgId])
    await client.query(
      `INSERT INTO public.committees (id, organization_id, name, committee_type, status)
       VALUES ($1, $2, 'safety', 'health_safety', 'active')`,
      [committeeId, orgId],
    )
    await client.query(`
      CREATE TABLE public.committee_meetings (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        committee_id uuid NOT NULL,
        organization_id uuid NOT NULL,
        title varchar(500) NOT NULL,
        meeting_date timestamptz NOT NULL,
        end_time timestamptz,
        location text,
        virtual_link text,
        status text NOT NULL DEFAULT 'scheduled',
        agenda text,
        agenda_items jsonb,
        minutes text,
        minutes_approved_by text,
        minutes_approved_at timestamptz,
        quorum_met boolean,
        attendee_count integer DEFAULT 0,
        external_attendees jsonb,
        decisions jsonb,
        next_meeting_date timestamptz,
        attachment_ids jsonb,
        created_at timestamptz DEFAULT now(),
        updated_at timestamptz DEFAULT now(),
        created_by text,
        updated_by text
      )
    `)
    await client.query(`
      CREATE TABLE public.committee_action_items (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        committee_id uuid NOT NULL,
        meeting_id uuid,
        organization_id uuid NOT NULL,
        title varchar(500) NOT NULL,
        description text,
        status text NOT NULL DEFAULT 'pending',
        priority text NOT NULL DEFAULT 'medium',
        assigned_to text,
        due_date date,
        completed_at timestamptz,
        completed_by text,
        resolution text,
        carried_from_meeting_id uuid,
        carry_count integer DEFAULT 0,
        created_at timestamptz DEFAULT now(),
        updated_at timestamptz DEFAULT now(),
        created_by text,
        updated_by text
      )
    `)
    await client.query(
      `INSERT INTO public.committee_meetings (id, committee_id, organization_id, title, meeting_date, status)
       VALUES ($1, $2, $3, 'monthly', now(), 'scheduled')`,
      [meetingId, committeeId, orgId],
    )
    await client.query(
      `INSERT INTO public.committee_action_items (
         id, committee_id, meeting_id, organization_id, title, status, priority
       ) VALUES ($1, $2, $3, $4, 'follow up', $5, 'medium')`,
      [actionId, committeeId, meetingId, orgId, actionStatus],
    )
    return { orgId, committeeId, meetingId, actionId }
  }

  await withDatabase('ue_stub_rel_committee', async (client) => {
    await installCommitteeHistory(client, 'pending')
    await applyEvolution(client)
    await applyEvolution(client)
    const row = await client.query(`
      SELECT item.status::text AS action_status,
             pg_typeof(item.status)::text AS action_status_type,
             item.priority::text AS priority,
             pg_typeof(item.priority)::text AS priority_type,
             meeting.status::text AS meeting_status,
             pg_typeof(meeting.status)::text AS meeting_status_type
      FROM public.committee_action_items item
      JOIN public.committee_meetings meeting ON meeting.id = item.meeting_id
    `)
    const statements = canonicalSql.split('--> statement-breakpoint').map((statement) => statement.trim()).filter(Boolean)
    await client.query('BEGIN')
    await client.query('CREATE TEMP TABLE IF NOT EXISTS ue_bootstrap_created_relations (relname text PRIMARY KEY) ON COMMIT DROP')
    for (const marker of [
      'incompatible existing relation public.committee_action_items: expected 19 matching columns',
      'incompatible existing relation public.committee_meetings: expected 24 matching columns',
      'constraint committee_action_items_committee_id_committees_id_fk is absent',
      'constraint committee_meetings_committee_id_committees_id_fk is absent',
    ]) {
      const statement = statements.find((candidate) => candidate.includes(marker))
      if (!statement) throw new Error(`missing 0009 statement ${marker}`)
      await client.query(statement)
    }
    await client.query('COMMIT')
    record('committee_text_enum', row.rows[0])
    const observed = row.rows[0]
    if (observed.action_status !== 'pending' || observed.action_status_type !== 'committee_action_item_status') {
      throw new Error(`action status was not preserved: ${JSON.stringify(observed)}`)
    }
    if (observed.priority !== 'medium' || observed.priority_type !== 'committee_action_item_priority') {
      throw new Error(`priority was not preserved: ${JSON.stringify(observed)}`)
    }
    if (observed.meeting_status !== 'scheduled' || observed.meeting_status_type !== 'committee_meeting_status') {
      throw new Error(`meeting status was not preserved: ${JSON.stringify(observed)}`)
    }
  })

  await withDatabase('ue_stub_rel_committee_bogus', async (client) => {
    await installCommitteeHistory(client, 'bogus')
    let message = ''
    try {
      await applyEvolution(client)
    } catch (error) {
      message = error.message
    }
    const types = await client.query(`
      SELECT item.status AS action_status, pg_typeof(item.status)::text AS action_status_type
      FROM public.committee_action_items item
    `)
    record('committee_bogus_status', { message, ...types.rows[0] })
    if (!message.includes('Rows were not rewritten')) {
      throw new Error(`bogus committee status did not fail closed: ${message}`)
    }
    if (types.rows[0].action_status !== 'bogus' || types.rows[0].action_status_type !== 'text') {
      throw new Error(`bogus committee status was rewritten: ${JSON.stringify(types.rows[0])}`)
    }
  })

  async function installJurisdiction(client, { orphan }) {
    await client.query(`CREATE TABLE public.organizations (id uuid PRIMARY KEY)`)
    const orgId = '88888888-8888-4888-8888-888888888888'
    const missingOrgId = '99999999-9999-4999-8999-999999999999'
    await client.query(`INSERT INTO public.organizations (id) VALUES ($1)`, [orgId])
    const reference = orphan ? '' : ' REFERENCES public.organizations(id) ON DELETE CASCADE'
    await client.query(`
      CREATE TABLE public.member_jurisdiction_preferences (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id text NOT NULL,
        organization_id uuid NOT NULL${reference},
        preferred_jurisdictions jsonb NOT NULL DEFAULT '[]'::jsonb,
        preferred_levels jsonb NOT NULL DEFAULT '[]'::jsonb,
        include_national boolean NOT NULL DEFAULT true,
        auto_apply boolean NOT NULL DEFAULT true,
        created_at timestamp NOT NULL DEFAULT now(),
        updated_at timestamp NOT NULL DEFAULT now(),
        UNIQUE (user_id, organization_id)
      )
    `)
    await client.query(
      `INSERT INTO public.member_jurisdiction_preferences (user_id, organization_id) VALUES ('user-1', $1)`,
      [orphan ? missingOrgId : orgId],
    )
  }

  await withDatabase('ue_stub_rel_jurisdiction', async (client) => {
    await installJurisdiction(client, { orphan: false })
    await applyEvolution(client)
    const names = await client.query(`
      SELECT conname FROM pg_constraint
      WHERE conrelid = 'public.member_jurisdiction_preferences'::regclass AND contype = 'f'
      ORDER BY conname
    `)
    const statements = canonicalSql.split('--> statement-breakpoint').map((statement) => statement.trim()).filter(Boolean)
    const fkCheck = statements.find((statement) =>
      statement.includes('constraint member_jurisdiction_preferences_organization_id_organizations_id_fk is absent'),
    )
    await client.query('BEGIN')
    await client.query('CREATE TEMP TABLE IF NOT EXISTS ue_bootstrap_created_relations (relname text PRIMARY KEY) ON COMMIT DROP')
    await client.query(fkCheck)
    await client.query('COMMIT')
    record('jurisdiction_fk', { constraints: names.rows.map((row) => row.conname) })
    const required = 'member_jurisdiction_preferences_organization_id_organizations_id_fk'.slice(0, 63)
    if (!names.rows.some((row) => row.conname === required)) {
      throw new Error(`required jurisdiction foreign key is absent: ${JSON.stringify(names.rows)}`)
    }
  })

  await withDatabase('ue_stub_rel_jurisdiction_orphan', async (client) => {
    await installJurisdiction(client, { orphan: true })
    let message = ''
    try {
      await applyEvolution(client)
    } catch (error) {
      message = error.message
    }
    const names = await client.query(`
      SELECT conname FROM pg_constraint
      WHERE conrelid = 'public.member_jurisdiction_preferences'::regclass AND contype = 'f'
    `)
    record('jurisdiction_orphan', { message, constraints: names.rows.map((row) => row.conname) })
    if (!message.includes('Rows were not rewritten')) {
      throw new Error(`orphan jurisdiction did not fail closed: ${message}`)
    }
    if (names.rows.length !== 0) {
      throw new Error(`orphan jurisdiction gained a foreign key: ${JSON.stringify(names.rows)}`)
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
