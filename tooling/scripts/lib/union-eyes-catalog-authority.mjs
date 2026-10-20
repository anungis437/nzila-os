/**
 * Source-governed privilege activation for the Union Eyes bootstrap.
 *
 * Public-schema grants come from the reviewed storage-authority manifest.
 * user_management and audit_security grants stay on the exact statements in
 * scoped migrations 0006, 0007, and 0008. This module does not emit SQL into
 * the frozen db/migrations lineage.
 */
import { spawnSync } from 'node:child_process'
import path from 'node:path'

const PRIVILEGE_ORDER = ['SELECT', 'INSERT', 'UPDATE', 'DELETE']
const RLS_REQUIRED = new Set([
  'TENANT_RLS_REQUIRED',
  'USER_RLS_REQUIRED',
  'PARENT_OWNED_RLS_REQUIRED',
  'MIXED_GLOBAL_TENANT_RLS_REQUIRED',
  'MULTI_PARTY_RLS_REQUIRED',
  'SYSTEM_ONLY',
])
const RUNTIME_SCHEMA_USAGE = ['public', 'user_management', 'audit_security']
const SYSTEM_SCHEMA_USAGE = ['public', 'user_management']

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

async function collectViolations(client, manifest) {
  const violations = []
  const roles = await client.query(
    `SELECT rolname, rolsuper, rolbypassrls, rolcreatedb, rolcreaterole
     FROM pg_roles
     WHERE rolname IN ('union_eyes_runtime', 'union_eyes_system')`,
  )
  const present = new Map(roles.rows.map((row) => [row.rolname, row]))
  for (const role of ['union_eyes_runtime', 'union_eyes_system']) {
    const attributes = present.get(role)
    if (!attributes) {
      violations.push(`${role} is absent`)
      continue
    }
    if (attributes.rolsuper || attributes.rolbypassrls || attributes.rolcreatedb || attributes.rolcreaterole) {
      violations.push(`${role} has a privileged attribute`)
    }
  }
  if (violations.length > 0) return violations

  const membership = await client.query(
    `SELECT member.rolname AS member, granted.rolname AS granted
     FROM pg_auth_members link
     JOIN pg_roles member ON member.oid = link.member
     JOIN pg_roles granted ON granted.oid = link.roleid
     WHERE member.rolname IN ('union_eyes_runtime', 'union_eyes_system')`,
  )
  for (const row of membership.rows) {
    violations.push(`${row.member} inherits ${row.granted}`)
  }

  for (const role of ['union_eyes_runtime', 'union_eyes_system']) {
    const expected = role === 'union_eyes_runtime' ? RUNTIME_SCHEMA_USAGE : SYSTEM_SCHEMA_USAGE
    const schemas = await client.query(
      `SELECT n.nspname
       FROM pg_namespace n
       WHERE n.nspname NOT IN ('pg_catalog', 'information_schema', 'pg_toast')
         AND n.nspname NOT LIKE 'pg_temp%'
         AND n.nspname NOT LIKE 'pg_toast_temp%'
         AND has_schema_privilege($1::name, n.oid, 'USAGE')`,
      [role],
    )
    const actual = schemas.rows.map((row) => row.nspname).sort()
    const wanted = [...expected].sort()
    if (actual.join(',') !== wanted.join(',')) {
      violations.push(`${role} schema USAGE is ${actual.join(',') || '(none)'}`)
    }
    for (const schema of ['public', 'user_management', 'audit_security']) {
      const create = await client.query('SELECT has_schema_privilege($1::name, $2::name, \'CREATE\') AS allowed', [
        role,
        schema,
      ])
      if (create.rows[0]?.allowed) violations.push(`${role} can CREATE in ${schema}`)
    }
  }

  const relations = await client.query(
    `SELECT n.nspname AS schema_name, c.relname AS table_name, c.relkind, c.relrowsecurity, c.relforcerowsecurity,
            c.relowner::regrole::text AS owner
     FROM pg_class c
     JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname IN ('public', 'user_management', 'audit_security')
       AND c.relkind IN ('r', 'p', 'v', 'm', 'f')
     ORDER BY 1, 2`,
  )

  const nonpublic = new Map(
    SCOPED_NONPUBLIC_PRIVILEGES.map((entry) => [`${entry.schema}.${entry.table}`, entry]),
  )

  for (const relation of relations.rows) {
    const key = `${relation.schema_name}.${relation.table_name}`
    const runtime = await effectivePrivileges(client, relation.schema_name, relation.table_name, 'union_eyes_runtime')
    const system = await effectivePrivileges(client, relation.schema_name, relation.table_name, 'union_eyes_system')
    if (relation.relkind === 'v' || relation.relkind === 'm') {
      if (runtime.length || system.length) violations.push(`${key} is a view with runtime or system privileges`)
      continue
    }
    if (relation.schema_name !== 'public') {
      const approved = nonpublic.get(key)
      if (!approved) {
        if (runtime.length || system.length) violations.push(`${key} has privileges outside the scoped auth contract`)
        continue
      }
      if (!samePrivileges(runtime, approved.runtime) || !samePrivileges(system, approved.system)) {
        violations.push(`${key} privileges are runtime[${runtime}] system[${system}]`)
      }
      if ((approved.runtime.length || approved.system.length) && !relation.relforcerowsecurity) {
        violations.push(`${key} is granted without FORCE RLS`)
      }
      continue
    }

    const entry = manifest.get(relation.table_name)
    if (!entry) {
      violations.push(`public.${relation.table_name} is unclassified`)
      continue
    }
    if (entry.classification === 'NEEDS_REVIEW') {
      violations.push(`public.${relation.table_name} is NEEDS_REVIEW`)
    }
    if (entry.runtime === 'TBD' || entry.system === 'TBD') {
      violations.push(`public.${relation.table_name} privileges are TBD`)
      continue
    }
    if (!samePrivileges(runtime, entry.runtime) || !samePrivileges(system, entry.system)) {
      violations.push(
        `public.${relation.table_name} privileges are runtime[${runtime}] system[${system}]`,
      )
    }
    if (RLS_REQUIRED.has(entry.classification)) {
      if (!relation.relrowsecurity || !relation.relforcerowsecurity) {
        violations.push(`public.${relation.table_name} lacks FORCE RLS`)
      } else {
        violations.push(...(await policyViolations(client, relation.table_name, entry)))
      }
    }
  }

  const sequences = await client.query(
    `SELECT count(*)::int AS count
     FROM pg_class c
     JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'public' AND c.relkind = 'S'`,
  )
  if (sequences.rows[0]?.count > 0) {
    const exposed = await client.query(
      `SELECT c.relname
       FROM pg_class c
       JOIN pg_namespace n ON n.oid = c.relnamespace
       WHERE n.nspname = 'public' AND c.relkind = 'S'
         AND (
           has_sequence_privilege('union_eyes_runtime', c.oid, 'USAGE')
           OR has_sequence_privilege('union_eyes_runtime', c.oid, 'SELECT')
           OR has_sequence_privilege('union_eyes_system', c.oid, 'USAGE')
           OR has_sequence_privilege('union_eyes_system', c.oid, 'SELECT')
         )`,
    )
    for (const row of exposed.rows) violations.push(`public sequence ${row.relname} is granted`)
  }

  const definers = await client.query(
    `SELECT n.nspname, p.proname
     FROM pg_proc p
     JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE p.prosecdef
       AND n.nspname NOT IN ('pg_catalog', 'information_schema')
       AND (
         has_function_privilege('union_eyes_runtime', p.oid, 'EXECUTE')
         OR has_function_privilege('union_eyes_system', p.oid, 'EXECUTE')
         OR has_function_privilege('public', p.oid, 'EXECUTE')
       )`,
  )
  for (const row of definers.rows) {
    violations.push(`${row.nspname}.${row.proname} is a SECURITY DEFINER function executable by a runtime principal`)
  }

  const columnGrants = await client.query(
    `SELECT n.nspname AS schema_name, c.relname AS table_name, a.attname AS column_name
     FROM pg_attribute a
     JOIN pg_class c ON c.oid = a.attrelid
     JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE a.attacl IS NOT NULL
       AND a.attnum > 0
       AND NOT a.attisdropped
       AND n.nspname IN ('public', 'user_management', 'audit_security')`,
  )
  for (const row of columnGrants.rows) {
    violations.push(`${row.schema_name}.${row.table_name}.${row.column_name} has a column ACL`)
  }

  const defaults = await client.query(
    `SELECT n.nspname, pg_get_userbyid(d.defaclrole) AS owner, d.defaclacl::text AS acl
     FROM pg_default_acl d
     LEFT JOIN pg_namespace n ON n.oid = d.defaclnamespace
     WHERE d.defaclacl::text LIKE '%union_eyes_runtime%'
        OR d.defaclacl::text LIKE '%union_eyes_system%'`,
  )
  for (const row of defaults.rows) {
    violations.push(`default privileges for ${row.owner} on ${row.nspname || 'database'} include a runtime role`)
  }

  return violations
}

async function policyViolations(client, table, entry) {
  const violations = []
  const policies = await client.query(
    `SELECT pol.polname, pol.polcmd, pol.polroles,
            pg_get_expr(pol.polqual, pol.polrelid) AS qual,
            pg_get_expr(pol.polwithcheck, pol.polrelid) AS with_check,
            COALESCE(array_agg(role.rolname) FILTER (WHERE role.rolname IS NOT NULL), ARRAY[]::name[]) AS roles
     FROM pg_policy pol
     JOIN pg_class relation ON relation.oid = pol.polrelid
     JOIN pg_namespace namespace ON namespace.oid = relation.relnamespace
     LEFT JOIN pg_roles role ON role.oid = ANY (pol.polroles)
     WHERE namespace.nspname = 'public' AND relation.relname = $1
     GROUP BY pol.polname, pol.polcmd, pol.polroles, pol.polqual, pol.polwithcheck, pol.polrelid`,
    [table],
  )
  const appliesTo = (policy, role) => policy.roles.length === 0 || policy.roles.includes(role)
  const covers = (policy, privilege) => {
    const command = { SELECT: 'r', INSERT: 'a', UPDATE: 'w', DELETE: 'd' }[privilege]
    return policy.polcmd === '*' || policy.polcmd === command
  }
  const runtimePolicies = policies.rows.filter((policy) => appliesTo(policy, 'union_eyes_runtime'))
  const systemPolicies = policies.rows.filter((policy) => appliesTo(policy, 'union_eyes_system'))
  if (entry.classification === 'SYSTEM_ONLY') {
    if (runtimePolicies.length > 0) violations.push(`public.${table} has a runtime RLS policy`)
    if (entry.system.length > 0 && systemPolicies.length === 0) {
      violations.push(`public.${table} has no system RLS policy`)
    }
    return violations
  }
  for (const policy of runtimePolicies) {
    if (policy.qual === 'true' || policy.with_check === 'true') {
      violations.push(`public.${table} runtime policy ${policy.polname} is permissive`)
    }
  }
  for (const privilege of entry.runtime) {
    if (!runtimePolicies.some((policy) => covers(policy, privilege))) {
      violations.push(`public.${table} has no runtime ${privilege} policy`)
    }
  }
  for (const privilege of entry.system) {
    if (!systemPolicies.some((policy) => covers(policy, privilege))) {
      violations.push(`public.${table} has no system ${privilege} policy`)
    }
  }
  return violations
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
      throw new Error(`Catalog privilege preflight failed:\n${violations.slice(0, 40).join('\n')}`)
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
