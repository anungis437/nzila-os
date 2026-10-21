/**
 * Read-only catalog admission rules shared by the Next.js health route and
 * the governance CLI. This module has no database driver and does not read
 * the repository checkout.
 */

import { createHash } from 'node:crypto'

const PRIVILEGE_ORDER = ['SELECT', 'INSERT', 'UPDATE', 'DELETE']

export const admissionQueries = [
  {
    name: 'roles',
    sql: `SELECT rolname, rolsuper, rolbypassrls, rolcreatedb, rolcreaterole
          FROM pg_roles
          WHERE rolname IN ('union_eyes_runtime', 'union_eyes_system')`,
  },
  {
    name: 'membership',
    sql: `SELECT member.rolname AS member, granted.rolname AS granted
          FROM pg_auth_members link
          JOIN pg_roles member ON member.oid = link.member
          JOIN pg_roles granted ON granted.oid = link.roleid
          WHERE member.rolname IN ('union_eyes_runtime', 'union_eyes_system')`,
  },
  {
    name: 'schemaUsage',
    sql: `SELECT r.rolname, n.nspname
          FROM pg_roles r
          JOIN pg_namespace n ON has_schema_privilege(r.oid, n.oid, 'USAGE')
          WHERE r.rolname IN ('union_eyes_runtime', 'union_eyes_system')
            AND n.nspname NOT IN ('pg_catalog', 'information_schema', 'pg_toast')
            AND n.nspname NOT LIKE 'pg_temp%'
            AND n.nspname NOT LIKE 'pg_toast_temp%'`,
  },
  {
    name: 'schemaCreate',
    sql: `SELECT r.rolname, s.nspname
          FROM pg_roles r
          CROSS JOIN (VALUES ('public'), ('user_management'), ('audit_security')) AS s(nspname)
          WHERE r.rolname IN ('union_eyes_runtime', 'union_eyes_system')
            AND has_schema_privilege(r.rolname, s.nspname::name, 'CREATE')`,
  },
  {
    name: 'relations',
    sql: `SELECT n.nspname AS schema_name,
                 c.relname AS table_name,
                 c.relkind,
                 c.relrowsecurity,
                 c.relforcerowsecurity,
                 ARRAY(
                   SELECT priv
                   FROM (VALUES (1, 'SELECT'), (2, 'INSERT'), (3, 'UPDATE'), (4, 'DELETE')) AS v(ord, priv)
                   WHERE has_table_privilege('union_eyes_runtime', c.oid, priv)
                   ORDER BY ord
                 ) AS runtime,
                 ARRAY(
                   SELECT priv
                   FROM (VALUES (1, 'SELECT'), (2, 'INSERT'), (3, 'UPDATE'), (4, 'DELETE')) AS v(ord, priv)
                   WHERE has_table_privilege('union_eyes_system', c.oid, priv)
                   ORDER BY ord
                 ) AS system
          FROM pg_class c
          JOIN pg_namespace n ON n.oid = c.relnamespace
          WHERE n.nspname IN ('public', 'user_management', 'audit_security')
            AND c.relkind IN ('r', 'p', 'v', 'm', 'f')
            AND EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'union_eyes_runtime')
            AND EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'union_eyes_system')
          ORDER BY 1, 2`,
  },
  {
    name: 'policies',
    sql: `SELECT relation.relname AS table_name,
                 pol.polname,
                 pol.polcmd,
                 pg_get_expr(pol.polqual, pol.polrelid) AS qual,
                 pg_get_expr(pol.polwithcheck, pol.polrelid) AS with_check,
                 COALESCE(array_agg(role.rolname) FILTER (WHERE role.rolname IS NOT NULL), ARRAY[]::name[]) AS roles
          FROM pg_policy pol
          JOIN pg_class relation ON relation.oid = pol.polrelid
          JOIN pg_namespace namespace ON namespace.oid = relation.relnamespace
          LEFT JOIN pg_roles role ON role.oid = ANY (pol.polroles)
          WHERE namespace.nspname = 'public'
          GROUP BY relation.relname, pol.polname, pol.polcmd, pol.polqual, pol.polwithcheck, pol.polrelid`,
  },
  {
    name: 'publicGrants',
    sql: `SELECT n.nspname AS schema_name, c.relname AS table_name, acl.privilege_type
          FROM pg_class c
          JOIN pg_namespace n ON n.oid = c.relnamespace
          CROSS JOIN LATERAL aclexplode(c.relacl) acl
          WHERE c.relacl IS NOT NULL
            AND n.nspname = 'public'
            AND c.relkind IN ('r', 'p', 'v', 'm')
            AND acl.grantee = 0
            AND acl.privilege_type IN ('SELECT', 'INSERT', 'UPDATE', 'DELETE')`,
  },
  {
    name: 'sequences',
    sql: `SELECT c.relname
          FROM pg_class c
          JOIN pg_namespace n ON n.oid = c.relnamespace
          WHERE n.nspname = 'public'
            AND c.relkind = 'S'
            AND EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'union_eyes_runtime')
            AND EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'union_eyes_system')
            AND (
              has_sequence_privilege('union_eyes_runtime', c.oid, 'USAGE')
              OR has_sequence_privilege('union_eyes_runtime', c.oid, 'SELECT')
              OR has_sequence_privilege('union_eyes_system', c.oid, 'USAGE')
              OR has_sequence_privilege('union_eyes_system', c.oid, 'SELECT')
            )`,
  },
  {
    name: 'definers',
    sql: `SELECT n.nspname, p.proname
          FROM pg_proc p
          JOIN pg_namespace n ON n.oid = p.pronamespace
          WHERE p.prosecdef
            AND n.nspname NOT IN ('pg_catalog', 'information_schema')
            AND EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'union_eyes_runtime')
            AND EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'union_eyes_system')
            AND (
              has_function_privilege('union_eyes_runtime', p.oid, 'EXECUTE')
              OR has_function_privilege('union_eyes_system', p.oid, 'EXECUTE')
              OR has_function_privilege('public', p.oid, 'EXECUTE')
            )`,
  },
  {
    name: 'dedicatedRoles',
    sql: `SELECT c.relname AS table_name,
                 r.rolname AS role_name,
                 ARRAY(
                   SELECT priv
                   FROM (VALUES (1, 'SELECT'), (2, 'INSERT'), (3, 'UPDATE'), (4, 'DELETE')) AS v(ord, priv)
                   WHERE has_table_privilege(r.oid, c.oid, priv)
                   ORDER BY ord
                 ) AS privileges
          FROM pg_class c
          JOIN pg_namespace n ON n.oid = c.relnamespace
          JOIN pg_roles r ON r.rolname IN (
            'ue_framework_admin', 'ue_framework_identity', 'ue_framework_worker'
          )
          WHERE n.nspname = 'public'
            AND c.relkind IN ('r', 'p')`,
  },
  {
    name: 'columnGrants',
    sql: `SELECT n.nspname AS schema_name, c.relname AS table_name, a.attname AS column_name,
                 COALESCE(g.rolname, 'PUBLIC') AS role_name, x.privilege_type
          FROM pg_attribute a
          JOIN pg_class c ON c.oid = a.attrelid
          JOIN pg_namespace n ON n.oid = c.relnamespace
          CROSS JOIN LATERAL aclexplode(a.attacl) x
          LEFT JOIN pg_roles g ON g.oid = x.grantee
          WHERE a.attacl IS NOT NULL
            AND a.attnum > 0
            AND NOT a.attisdropped
            AND n.nspname IN ('public', 'user_management', 'audit_security')
          ORDER BY 1, 2, 4, 5, 3`,
  },
  {
    name: 'defaults',
    sql: `SELECT n.nspname, pg_get_userbyid(d.defaclrole) AS owner, d.defaclacl::text AS acl
          FROM pg_default_acl d
          LEFT JOIN pg_namespace n ON n.oid = d.defaclnamespace
          WHERE d.defaclacl::text LIKE '%union_eyes_runtime%'
             OR d.defaclacl::text LIKE '%union_eyes_system%'`,
  },
]

export function catalogContractDigest(payload) {
  return createHash('sha256').update(JSON.stringify(payload)).digest('hex')
}

function asArray(value) {
  if (Array.isArray(value)) return value.map((item) => String(item))
  if (value == null) return []
  const text = String(value)
  if (text === '{}' || text === '') return []
  if (text.startsWith('{') && text.endsWith('}')) {
    return text.slice(1, -1).split(',').filter(Boolean)
  }
  return [text]
}

function samePrivileges(actual, expected) {
  return actual.length === expected.length && actual.every((privilege, index) => privilege === expected[index])
}

function rows(snapshots, name) {
  const value = snapshots?.[name]
  return Array.isArray(value) ? value : []
}

function policyViolations(table, entry, policies) {
  const violations = []
  const appliesTo = (policy, role) => policy.roles.length === 0 || policy.roles.includes(role)
  const covers = (policy, privilege) => {
    const command = { SELECT: 'r', INSERT: 'a', UPDATE: 'w', DELETE: 'd' }[privilege]
    return policy.polcmd === '*' || policy.polcmd === command
  }
  const runtimePolicies = policies.filter((policy) => appliesTo(policy, 'union_eyes_runtime'))
  const systemPolicies = policies.filter((policy) => appliesTo(policy, 'union_eyes_system'))
  if (
    entry.classification === 'SYSTEM_ONLY' ||
    entry.classification === 'FRAMEWORK_DEDICATED_EXECUTION_CONTEXT' ||
    entry.classification === 'PLATFORM_METADATA_DEDICATED_EXECUTION_CONTEXT'
  ) {
    if (runtimePolicies.length > 0) violations.push(`public.${table} has a runtime RLS policy`)
    if (entry.classification !== 'SYSTEM_ONLY' && systemPolicies.length > 0) {
      violations.push(`public.${table} has a system RLS policy`)
    }
    if (entry.classification === 'SYSTEM_ONLY' && entry.system.length > 0 && systemPolicies.length === 0) {
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

export function assessCatalogAdmission(contract, snapshots, environment = 'unknown') {
  const violations = []
  const payload = contract?.payload
  if (!payload || catalogContractDigest(payload) !== contract?.digest || !Array.isArray(payload.entries) || payload.entries.length < 100) {
    violations.push('catalog contract digest is invalid')
    return {
      ok: false,
      applicationReady: false,
      environment,
      source: 'apps/union-eyes/lib/operations/catalog-authority-contract.json',
      violations,
    }
  }

  const manifest = new Map(payload.entries.map((entry) => [entry.table, entry]))
  const nonpublic = new Map(payload.nonPublic.map((entry) => [`${entry.schema}.${entry.table}`, entry]))
  const rlsRequired = new Set(payload.rlsRequired)
  const present = new Map(rows(snapshots, 'roles').map((row) => [row.rolname, row]))
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
  if (violations.length > 0) {
    return report(environment, violations)
  }

  for (const row of rows(snapshots, 'membership')) {
    violations.push(`${row.member} inherits ${row.granted}`)
  }

  for (const role of ['union_eyes_runtime', 'union_eyes_system']) {
    const expected = role === 'union_eyes_runtime' ? payload.runtimeSchemaUsage : payload.systemSchemaUsage
    const actual = rows(snapshots, 'schemaUsage')
      .filter((row) => row.rolname === role)
      .map((row) => row.nspname)
      .sort()
    const wanted = [...expected].sort()
    if (actual.join(',') !== wanted.join(',')) {
      violations.push(`${role} schema USAGE is ${actual.join(',') || '(none)'}`)
    }
  }
  for (const row of rows(snapshots, 'schemaCreate')) {
    violations.push(`${row.rolname} can CREATE in ${row.nspname}`)
  }

  const policiesByTable = new Map()
  for (const policy of rows(snapshots, 'policies')) {
    const normalized = { ...policy, roles: asArray(policy.roles) }
    const list = policiesByTable.get(policy.table_name) ?? []
    list.push(normalized)
    policiesByTable.set(policy.table_name, list)
  }

  for (const relation of rows(snapshots, 'relations')) {
    const key = `${relation.schema_name}.${relation.table_name}`
    const runtime = asArray(relation.runtime)
    const system = asArray(relation.system)
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
    if (entry.classification === 'NEEDS_REVIEW') violations.push(`public.${relation.table_name} is NEEDS_REVIEW`)
    if (entry.runtime === 'TBD' || entry.system === 'TBD') {
      violations.push(`public.${relation.table_name} privileges are TBD`)
      continue
    }
    if (!samePrivileges(runtime, entry.runtime) || !samePrivileges(system, entry.system)) {
      violations.push(`public.${relation.table_name} privileges are runtime[${runtime}] system[${system}]`)
    }
    if (rlsRequired.has(entry.classification)) {
      if (!relation.relrowsecurity || !relation.relforcerowsecurity) {
        violations.push(`public.${relation.table_name} lacks FORCE RLS`)
      } else {
        violations.push(...policyViolations(relation.table_name, entry, policiesByTable.get(relation.table_name) ?? []))
      }
    }
  }

  const presentPublic = new Set(
    rows(snapshots, 'relations')
      .filter((relation) => relation.schema_name === 'public')
      .map((relation) => relation.table_name),
  )
  const dedicatedActual = new Map()
  for (const row of rows(snapshots, 'dedicatedRoles')) {
    dedicatedActual.set(`${row.table_name}|${row.role_name}`, asArray(row.privileges))
  }
  for (const expected of payload.dedicatedRolePrivileges ?? []) {
    if (!presentPublic.has(expected.table)) continue
    const actual = dedicatedActual.get(`${expected.table}|${expected.role}`) ?? []
    if (!samePrivileges(actual, expected.privileges)) {
      violations.push(`public.${expected.table} ${expected.role} privileges are [${actual}]`)
    }
  }

  for (const row of rows(snapshots, 'publicGrants')) {
    violations.push(`PUBLIC holds ${row.privilege_type} on ${row.schema_name}.${row.table_name}`)
  }
  for (const row of rows(snapshots, 'sequences')) violations.push(`public sequence ${row.relname} is granted`)
  for (const row of rows(snapshots, 'definers')) {
    violations.push(`${row.nspname}.${row.proname} is a SECURITY DEFINER function executable by a runtime principal`)
  }
  const approvedColumns = new Map(
    (payload.approvedColumnGrants ?? []).map((grant) => [
      `${grant.schema}.${grant.table}|${grant.role}|${grant.privilege}`,
      grant,
    ]),
  )
  const actualColumns = new Map()
  for (const row of rows(snapshots, 'columnGrants')) {
    const key = `${row.schema_name}.${row.table_name}|${row.role_name}|${row.privilege_type}`
    if (!approvedColumns.has(key)) {
      violations.push(
        `${row.schema_name}.${row.table_name}.${row.column_name} has an unapproved column ACL (${row.role_name} ${row.privilege_type})`,
      )
      continue
    }
    actualColumns.set(key, [...(actualColumns.get(key) ?? []), row.column_name])
  }
  const presentRelations = new Set(
    rows(snapshots, 'relations').map((relation) => `${relation.schema_name}.${relation.table_name}`),
  )
  for (const [key, grant] of approvedColumns) {
    if (!presentRelations.has(`${grant.schema}.${grant.table}`)) continue
    const actual = [...(actualColumns.get(key) ?? [])].sort()
    const expected = [...grant.columns].sort()
    if (actual.length !== expected.length || actual.some((column, index) => column !== expected[index])) {
      violations.push(
        `${grant.schema}.${grant.table} ${grant.role} ${grant.privilege} columns are [${actual}], expected [${expected}]`,
      )
    }
  }
  for (const row of rows(snapshots, 'defaults')) {
    violations.push(`default privileges for ${row.owner} on ${row.nspname || 'database'} include a runtime role`)
  }

  return report(environment, violations)
}

function report(environment, violations) {
  return {
    ok: violations.length === 0,
    applicationReady: false,
    environment,
    source: 'apps/union-eyes/lib/operations/catalog-authority-contract.json',
    violations,
  }
}

export function privilegesInOrder(value) {
  if (value === 'TBD') return 'TBD'
  const privileges = [...(value ?? [])]
  return PRIVILEGE_ORDER.filter((privilege) => privileges.includes(privilege))
}
