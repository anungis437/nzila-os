/**
 * Physical verification of scoped foundation security effects.
 * A hash in drizzle.__drizzle_migrations does not prove the effect.
 */
import { SCOPED_NONPUBLIC_PRIVILEGES } from './union-eyes-catalog-authority.mjs'
import { computeMigrationHash, getAppliedHashes } from './union-eyes-scoped-migrations.mjs'

const EFFECT_TAGS = [
  '0006_external_specialist_runtime_privilege_closure',
  '0007_auth_bootstrap_runtime_remediation',
  '0008_runtime_acceptance_closure',
  '0009_baseline_runtime_role_grants',
]

const PHYSICAL_RELATIONS = [
  ['user_management', 'users'],
  ['user_management', 'organization_users'],
  ['user_management', 'auth_audit_log'],
  ['user_management', 'mfa_totp'],
  ['user_management', 'org_auth_policies'],
  ['user_management', 'user_sessions'],
  ['audit_security', 'audit_logs'],
]

async function privileges(client, schema, table, role) {
  const held = []
  for (const privilege of ['SELECT', 'INSERT', 'UPDATE', 'DELETE']) {
    const result = await client.query(
      `SELECT has_table_privilege($1::name, format('%I.%I', $2::text, $3::text)::regclass, $4::text) AS allowed`,
      [role, schema, table, privilege],
    )
    if (result.rows[0]?.allowed) held.push(privilege)
  }
  return held
}

function same(actual, expected) {
  return actual.length === expected.length && actual.every((privilege, index) => privilege === expected[index])
}

export async function verifyRestoredAuthority(client, { migrationsDir, restored }) {
  const applied = await getAppliedHashes(client)
  const recorded = {}
  let historicalMigrationRecorded = true
  for (const tag of EFFECT_TAGS) {
    const { hash } = computeMigrationHash(migrationsDir, tag)
    recorded[tag] = applied.has(hash)
    if (!recorded[tag]) historicalMigrationRecorded = false
  }

  const missingRelations = []
  for (const [schema, table] of PHYSICAL_RELATIONS) {
    const result = await client.query(`SELECT to_regclass(format('%I.%I', $1::text, $2::text)) AS regclass`, [
      schema,
      table,
    ])
    if (!result.rows[0]?.regclass) missingRelations.push(`${schema}.${table}`)
  }
  const physicalSchemaVerified = missingRelations.length === 0

  const securityGaps = []
  const publicCreate = await client.query(
    `SELECT has_schema_privilege('public', 'public', 'CREATE') AS allowed`,
  )
  if (publicCreate.rows[0]?.allowed) securityGaps.push('PUBLIC can CREATE in public')
  for (const role of ['union_eyes_runtime', 'union_eyes_system']) {
    for (const schema of ['public', 'user_management', 'audit_security']) {
      const exists = await client.query(`SELECT to_regnamespace($1) AS namespace`, [schema])
      if (!exists.rows[0]?.namespace) continue
      const create = await client.query(`SELECT has_schema_privilege($1::name, $2::name, 'CREATE') AS allowed`, [
        role,
        schema,
      ])
      if (create.rows[0]?.allowed) securityGaps.push(`${role} can CREATE in ${schema}`)
    }
  }
  if (physicalSchemaVerified) {
    for (const entry of SCOPED_NONPUBLIC_PRIVILEGES) {
      const runtime = await privileges(client, entry.schema, entry.table, 'union_eyes_runtime')
      const system = await privileges(client, entry.schema, entry.table, 'union_eyes_system')
      if (!same(runtime, entry.runtime) || !same(system, entry.system)) {
        securityGaps.push(
          `${entry.schema}.${entry.table} privileges are runtime[${runtime}] system[${system}]`,
        )
      }
    }
    const forced = await client.query(
      `SELECT c.relforcerowsecurity
       FROM pg_class c
       JOIN pg_namespace n ON n.oid = c.relnamespace
       WHERE n.nspname = 'audit_security' AND c.relname = 'audit_logs'`,
    )
    if (!forced.rows[0]?.relforcerowsecurity) securityGaps.push('audit_security.audit_logs lacks FORCE RLS')
    const policy = await client.query(
      `SELECT 1 FROM pg_policy pol
       JOIN pg_class c ON c.oid = pol.polrelid
       JOIN pg_namespace n ON n.oid = c.relnamespace
       WHERE n.nspname = 'audit_security' AND c.relname = 'audit_logs' AND pol.polname = 'ue_runtime_audit_insert'`,
    )
    if (policy.rowCount === 0) securityGaps.push('ue_runtime_audit_insert is absent')
  } else {
    securityGaps.push('physical relations are absent')
  }

  const securityEffectsVerified = securityGaps.length === 0
  const restoreReconciliationComplete =
    historicalMigrationRecorded && physicalSchemaVerified && securityEffectsVerified
  return {
    mode: restored ? 'snapshot' : 'fresh',
    HISTORICAL_MIGRATION_RECORDED: historicalMigrationRecorded,
    PHYSICAL_SCHEMA_VERIFIED: physicalSchemaVerified,
    SECURITY_EFFECTS_VERIFIED: securityEffectsVerified,
    RESTORE_RECONCILIATION_COMPLETE: restoreReconciliationComplete,
    recorded,
    missingRelations,
    securityGaps,
    hashDoesNotImplyEffects: true,
  }
}

export async function recordRestoredAuthority(client, report) {
  await client.query('CREATE SCHEMA IF NOT EXISTS drizzle')
  await client.query(`
    CREATE TABLE IF NOT EXISTS drizzle.restore_authority_reconciliation (
      id serial PRIMARY KEY,
      recorded_at timestamptz NOT NULL DEFAULT now(),
      mode text NOT NULL,
      historical_migration_recorded boolean NOT NULL,
      physical_schema_verified boolean NOT NULL,
      security_effects_verified boolean NOT NULL,
      restore_reconciliation_complete boolean NOT NULL,
      detail jsonb NOT NULL
    )
  `)
  if (!report.RESTORE_RECONCILIATION_COMPLETE) {
    throw new Error(
      `Restore authority reconciliation is incomplete:\n${JSON.stringify({
        missingRelations: report.missingRelations,
        securityGaps: report.securityGaps,
        recorded: report.recorded,
      })}`,
    )
  }
  await client.query(
    `INSERT INTO drizzle.restore_authority_reconciliation
       (mode, historical_migration_recorded, physical_schema_verified,
        security_effects_verified, restore_reconciliation_complete, detail)
     VALUES ($1, true, true, true, true, $2::jsonb)`,
    [report.mode, JSON.stringify(report)],
  )
  return report
}

export async function grantRuntimeConnect(client) {
  await client.query(
    `DO $connect$ BEGIN
       EXECUTE format('GRANT CONNECT ON DATABASE %I TO union_eyes_runtime, union_eyes_system', current_database());
     END $connect$`,
  )
}
