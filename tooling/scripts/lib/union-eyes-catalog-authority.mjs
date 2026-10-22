/**
 * Source-governed privilege activation for the Union Eyes bootstrap.
 *
 * Public-schema grants come from the reviewed storage-authority manifest.
 * user_management and audit_security grants stay on the exact statements in
 * scoped migrations 0006, 0007, and 0008. This module does not emit SQL into
 * the frozen db/migrations lineage.
 */
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import {
  admissionQueries,
  assessCatalogAdmission,
  catalogContractDigest,
  privilegesInOrder,
} from '../../../apps/union-eyes/lib/operations/catalog-admission-core.mjs'

const PRIVILEGE_ORDER = ['SELECT', 'INSERT', 'UPDATE', 'DELETE']
export const RLS_REQUIRED_CLASSIFICATIONS = [
  'TENANT_RLS_REQUIRED',
  'USER_RLS_REQUIRED',
  'PARENT_OWNED_RLS_REQUIRED',
  'MIXED_GLOBAL_TENANT_RLS_REQUIRED',
  'MULTI_PARTY_RLS_REQUIRED',
  'SYSTEM_ONLY',
  'FRAMEWORK_DEDICATED_EXECUTION_CONTEXT',
  'PLATFORM_METADATA_DEDICATED_EXECUTION_CONTEXT',
]
const RLS_REQUIRED = new Set(RLS_REQUIRED_CLASSIFICATIONS)
export const RUNTIME_SCHEMA_USAGE = ['public', 'user_management', 'audit_security']
export const SYSTEM_SCHEMA_USAGE = ['public', 'user_management']

/**
 * Exact non-public grants installed by the scoped auth migrations.
 * 0006: runtime SELECT on user_management.users and organization_users.
 * 0007: system grants on the auth tables.
 * 0008: runtime INSERT on audit_security.audit_logs.
 */
export const SCOPED_NONPUBLIC_PRIVILEGES = [
  { schema: 'user_management', table: 'users', runtime: ['SELECT'], system: ['SELECT', 'UPDATE'] },
  { schema: 'user_management', table: 'organization_users', runtime: ['SELECT'], system: ['SELECT'] },
  { schema: 'user_management', table: 'auth_audit_log', runtime: [], system: ['SELECT', 'INSERT'] },
  { schema: 'user_management', table: 'mfa_totp', runtime: [], system: ['SELECT'] },
  { schema: 'user_management', table: 'org_auth_policies', runtime: [], system: ['SELECT'] },
  { schema: 'user_management', table: 'user_sessions', runtime: [], system: ['SELECT', 'INSERT', 'UPDATE', 'DELETE'] },
  { schema: 'audit_security', table: 'audit_logs', runtime: ['INSERT'], system: [] },
]

/**
 * The authority-reader role owns the framework SECURITY DEFINER helpers. It may
 * read only the columns those helpers evaluate. Mirrors FRAMEWORK_READER_COLUMNS
 * in scripts/bootstrap-v2/framework-contract.ts; a unit test keeps them equal.
 */
export const AUTHORITY_READER_COLUMN_GRANTS = [
  {
    schema: 'user_management',
    table: 'users',
    role: 'ue_framework_authority_reader',
    privilege: 'SELECT',
    columns: ['user_id', 'is_active', 'lifecycle_state', 'is_system_admin'],
  },
  {
    schema: 'user_management',
    table: 'user_sessions',
    role: 'ue_framework_authority_reader',
    privilege: 'SELECT',
    columns: ['user_id', 'organization_id', 'session_token_hash', 'is_active', 'expires_at'],
  },
]

function approvedColumnGrants(manifest) {
  const grants = [
    ...[...manifest.values()].flatMap((entry) =>
      (entry.frameworkColumnGrants ?? []).map((grant) => ({
        schema: 'public',
        table: entry.table,
        role: grant.role,
        privilege: grant.privilege,
        columns: [...grant.columns].sort(),
      })),
    ),
    ...AUTHORITY_READER_COLUMN_GRANTS.map((grant) => ({ ...grant, columns: [...grant.columns].sort() })),
  ]
  return grants.sort((left, right) =>
    `${left.schema}.${left.table}:${left.role}:${left.privilege}`.localeCompare(
      `${right.schema}.${right.table}:${right.role}:${right.privilege}`,
    ),
  )
}

function quoteIdent(value) {
  if (!/^[a-z_][a-z0-9_]*$/.test(value)) {
    throw new Error(`Refusing to interpolate identifier ${value}`)
  }
  return `"${value}"`
}

function privilegeSet(value, table, side) {
  if (value === 'TBD') return 'TBD'
  const privileges = [...(value ?? [])]
  for (const privilege of privileges) {
    if (!PRIVILEGE_ORDER.includes(privilege)) {
      throw new Error(`${table} ${side} privilege ${privilege} is not an approved atom.`)
    }
  }
  return PRIVILEGE_ORDER.filter((privilege) => privileges.includes(privilege))
}

export function loadAuthorityManifest(repoRoot) {
  const script = path.join(repoRoot, 'tooling/scripts/export-union-eyes-authority-contract.ts')
  const result = spawnSync('pnpm', ['exec', 'tsx', script], {
    cwd: path.join(repoRoot, 'apps/union-eyes'),
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024,
  })
  if (result.status !== 0) {
    throw new Error(`Storage-authority manifest export failed: ${result.stderr || result.stdout}`)
  }
  const rows = JSON.parse(result.stdout)
  const byTable = new Map()
  for (const row of rows) {
    if (byTable.has(row.table)) {
      throw new Error(`Storage-authority manifest has a duplicate table ${row.table}.`)
    }
    byTable.set(row.table, {
      table: row.table,
      classification: row.classification,
      runtime: privilegeSet(row.runtime, row.table, 'runtime'),
      system: privilegeSet(row.system, row.table, 'system'),
      frameworkRolePrivileges: (row.frameworkRolePrivileges ?? []).map((grant) => ({
        role: grant.role,
        privileges: privilegeSet(grant.privileges, `${row.table} ${grant.role}`, 'dedicated'),
      })),
      frameworkColumnGrants: (row.frameworkColumnGrants ?? []).map((grant) => ({
        role: grant.role,
        privilege: grant.privilege,
        columns: [...grant.columns],
      })),
    })
  }
  return byTable
}

async function tableExists(client, schema, table) {
  const result = await client.query('SELECT to_regclass(format(\'%I.%I\', $1::text, $2::text)) AS regclass', [
    schema,
    table,
  ])
  return Boolean(result.rows[0]?.regclass)
}

async function effectivePrivileges(client, schema, table, role) {
  const held = []
  for (const privilege of PRIVILEGE_ORDER) {
    const result = await client.query('SELECT has_table_privilege($1::name, format(\'%I.%I\', $2::text, $3::text)::regclass, $4::text) AS allowed', [
      role,
      schema,
      table,
      privilege,
    ])
    if (result.rows[0]?.allowed) held.push(privilege)
  }
  return held
}

function samePrivileges(actual, expected) {
  return actual.length === expected.length && actual.every((privilege, index) => privilege === expected[index])
}

async function loadAdmissionSnapshots(client) {
  const snapshots = {}
  for (const query of admissionQueries) {
    const result = await client.query(query.sql)
    snapshots[query.name] = result.rows
  }
  return snapshots
}

export function contractFromManifest(manifest) {
  const entries = [...manifest.values()]
    .map((entry) => ({
      table: entry.table,
      classification: entry.classification,
      runtime: privilegesInOrder(entry.runtime),
      system: privilegesInOrder(entry.system),
    }))
    .sort((left, right) => left.table.localeCompare(right.table))
  const payload = {
    entries,
    nonPublic: SCOPED_NONPUBLIC_PRIVILEGES.map((entry) => ({
      schema: entry.schema,
      table: entry.table,
      runtime: privilegesInOrder(entry.runtime),
      system: privilegesInOrder(entry.system),
    })),
    runtimeSchemaUsage: [...RUNTIME_SCHEMA_USAGE],
    systemSchemaUsage: [...SYSTEM_SCHEMA_USAGE],
    rlsRequired: [...RLS_REQUIRED_CLASSIFICATIONS],
    dedicatedRolePrivileges: [...manifest.values()]
      .flatMap((entry) =>
        (entry.frameworkRolePrivileges ?? []).map((grant) => ({
          table: entry.table,
          role: grant.role,
          privileges: privilegesInOrder(grant.privileges),
        })),
      )
      .sort((left, right) => `${left.table}:${left.role}`.localeCompare(`${right.table}:${right.role}`)),
    approvedColumnGrants: approvedColumnGrants(manifest),
  }
  return { digest: catalogContractDigest(payload), payload }
}

export function readCatalogContract(repoRoot) {
  const contractPath = path.join(repoRoot, 'apps/union-eyes/lib/operations/catalog-authority-contract.json')
  return JSON.parse(fs.readFileSync(contractPath, 'utf8'))
}

export function assertCatalogContractCurrent(repoRoot) {
  const contract = readCatalogContract(repoRoot)
  if (catalogContractDigest(contract.payload) !== contract.digest) {
    throw new Error('Catalog contract digest does not match its payload.')
  }
  const live = contractFromManifest(loadAuthorityManifest(repoRoot))
  if (JSON.stringify(live.payload) !== JSON.stringify(contract.payload)) {
    throw new Error('Catalog contract does not match the storage-authority source.')
  }
  return contract
}

async function collectViolations(client, manifest) {
  const contract = contractFromManifest(manifest)
  const snapshots = await loadAdmissionSnapshots(client)
  return assessCatalogAdmission(contract, snapshots).violations
}

async function grantExactPublicPrivileges(client, manifest) {
  for (const entry of manifest.values()) {
    if (!(await tableExists(client, 'public', entry.table))) continue
    const relation = `public.${quoteIdent(entry.table)}`
    if (entry.runtime === 'TBD' || entry.system === 'TBD') continue
    if (entry.runtime.length > 0) {
      await client.query(`GRANT ${entry.runtime.join(', ')} ON TABLE ${relation} TO union_eyes_runtime`)
    }
    if (entry.system.length > 0) {
      await client.query(`GRANT ${entry.system.join(', ')} ON TABLE ${relation} TO union_eyes_system`)
    }
  }
}

export async function diagnoseCatalogAuthority(client, { repoRoot, environment } = {}) {
  const contract = assertCatalogContractCurrent(repoRoot)
  const snapshots = await loadAdmissionSnapshots(client)
  return assessCatalogAdmission(
    contract,
    snapshots,
    environment || process.env.UE_ENVIRONMENT || process.env.NODE_ENV || 'unknown',
  )
}

export function formatCatalogDiagnostic(report) {
  const header = [
    `environment=${report.environment}`,
    `source=${report.source}`,
    'applicationReady=false',
    `violationCount=${report.violations.length}`,
  ]
  return [...header, ...report.violations].join('\n')
}

/**
 * Isolated remediation. Refuses unless UE_PRIVILEGE_ENFORCEMENT=1.
 * Revokes inherited memberships, PUBLIC and runtime grants, and unsafe
 * SECURITY DEFINER execution, then re-applies the exact manifest. It does
 * not run on the read-only admission path.
 */
export async function remediateCatalogAuthority(client, { repoRoot }) {
  if (process.env.UE_PRIVILEGE_ENFORCEMENT !== '1') {
    throw new Error('Remediation refused. Set UE_PRIVILEGE_ENFORCEMENT=1 on an isolated database.')
  }
  await client.query('BEGIN')
  try {
    const inherited = await client.query(
      `SELECT member.rolname AS member, parent.rolname AS parent
       FROM pg_auth_members membership
       JOIN pg_roles member ON member.oid = membership.member
       JOIN pg_roles parent ON parent.oid = membership.roleid
       WHERE member.rolname IN ('union_eyes_runtime', 'union_eyes_system')`,
    )
    for (const row of inherited.rows) {
      await client.query(`REVOKE ${quoteIdent(row.parent)} FROM ${quoteIdent(row.member)}`)
    }
    const definers = await client.query(
      `SELECT p.oid::regprocedure::text AS identity
       FROM pg_proc p
       JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE p.prosecdef AND n.nspname NOT IN ('pg_catalog', 'information_schema')`,
    )
    for (const row of definers.rows) {
      await client.query(
        `REVOKE ALL ON FUNCTION ${row.identity} FROM union_eyes_runtime, union_eyes_system, PUBLIC`,
      )
    }
    await client.query('COMMIT')
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  }
  for (const fileName of [
    '0016_catalog_rls_authority_closure.sql',
    '0017_snapshot_authority_reconciliation.sql',
    '0018_knowledge_transfer_rls_closure.sql',
    '0019_deadline_reassignment_convergence.sql',
  ]) {
    const migration = fs.readFileSync(
      path.join(repoRoot, 'apps/union-eyes/db/migrations-cache', fileName),
      'utf8',
    )
    for (const statement of migration.split('--> statement-breakpoint')) {
      const sql = statement.trim()
      if (!sql.replace(/--.*$/gm, '').trim()) continue
      await client.query(sql)
    }
  }
  return activateCatalogPrivileges(client, { repoRoot, enforce: true })
}

/**
 * Verify the live catalog. When enforce is true, public privileges are
 * revoked and replaced with the manifest before verification. A failed
 * verification rolls back the grants and leaves the preceding revoke
 * committed, so the failure path does not keep the broad envelope.
 */
export async function activateCatalogPrivileges(client, { repoRoot, enforce }) {
  const manifest = loadAuthorityManifest(repoRoot)
  const roles = await client.query(
    `SELECT rolname FROM pg_roles WHERE rolname IN ('union_eyes_runtime', 'union_eyes_system')`,
  )
  if (roles.rowCount !== 2) {
    throw new Error('Runtime roles are absent. Refusing to treat that as operational readiness.')
  }
  if (enforce) {
    await client.query('BEGIN')
    try {
      await client.query('REVOKE ALL ON ALL TABLES IN SCHEMA public FROM union_eyes_runtime, union_eyes_system, PUBLIC')
      await client.query(
        'REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM union_eyes_runtime, union_eyes_system, PUBLIC',
      )
      await client.query('COMMIT')
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    }
  }
  await client.query('BEGIN')
  try {
    if (enforce) await grantExactPublicPrivileges(client, manifest)
    const violations = await collectViolations(client, manifest)
    if (violations.length > 0) {
      throw new Error(`Catalog privilege preflight failed:\n${violations.join('\n')}`)
    }
    await client.query('COMMIT')
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  }
  return {
    applied: Boolean(enforce),
    schemaMigrationComplete: true,
    securityPolicyVerified: true,
    runtimePrivilegesVerified: true,
    applicationReady: false,
    manifestEntries: manifest.size,
  }
}
