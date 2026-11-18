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
          FROM pg_catalog.pg_roles
          WHERE rolname IN ('union_eyes_runtime', 'union_eyes_system')`,
  },
  {
    name: 'membership',
    sql: `SELECT member.rolname AS member, granted.rolname AS granted
          FROM pg_catalog.pg_auth_members link
          JOIN pg_catalog.pg_roles member ON member.oid = link.member
          JOIN pg_catalog.pg_roles granted ON granted.oid = link.roleid
          WHERE member.rolname IN ('union_eyes_runtime', 'union_eyes_system')`,
  },
  {
    name: 'schemaUsage',
    sql: `SELECT r.rolname, n.nspname
          FROM pg_catalog.pg_roles r
          JOIN pg_catalog.pg_namespace n ON pg_catalog.has_schema_privilege(r.oid, n.oid, 'USAGE')
          WHERE r.rolname IN ('union_eyes_runtime', 'union_eyes_system')
            AND n.nspname NOT IN ('pg_catalog', 'information_schema', 'pg_toast')
            AND n.nspname NOT LIKE 'pg_temp%'
            AND n.nspname NOT LIKE 'pg_toast_temp%'`,
  },
  {
    name: 'schemaCreate',
    // Only schemas that EXIST are inspected: pg_catalog.has_schema_privilege raises on a missing schema, which made admission fail outright on a
    // topology that has no audit_security schema (a missing schema holds no privilege to leak).
    sql: `SELECT r.rolname, s.nspname
          FROM pg_catalog.pg_roles r
          CROSS JOIN (SELECT nspname FROM pg_catalog.pg_namespace WHERE nspname IN ('public', 'user_management', 'audit_security')) AS s
          WHERE r.rolname IN ('union_eyes_runtime', 'union_eyes_system')
            AND pg_catalog.has_schema_privilege(r.rolname, s.nspname::name, 'CREATE')`,
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
                   FROM (VALUES (1, 'SELECT'), (2, 'INSERT'), (3, 'UPDATE'), (4, 'DELETE'), (5, 'REFERENCES'), (6, 'TRIGGER'), (7, 'TRUNCATE')) AS v(ord, priv)
                   WHERE pg_catalog.has_table_privilege('union_eyes_runtime', c.oid, priv)
                   ORDER BY ord
                 ) AS runtime,
                 ARRAY(
                   SELECT priv
                   FROM (VALUES (1, 'SELECT'), (2, 'INSERT'), (3, 'UPDATE'), (4, 'DELETE'), (5, 'REFERENCES'), (6, 'TRIGGER'), (7, 'TRUNCATE')) AS v(ord, priv)
                   WHERE pg_catalog.has_table_privilege('union_eyes_system', c.oid, priv)
                   ORDER BY ord
                 ) AS system
          FROM pg_catalog.pg_class c
          JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
          WHERE n.nspname IN ('public', 'user_management', 'audit_security')
            AND c.relkind IN ('r', 'p', 'v', 'm', 'f')
            AND EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = 'union_eyes_runtime')
            AND EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = 'union_eyes_system')
          ORDER BY 1, 2`,
  },
  {
    name: 'policies',
    sql: `SELECT relation.relname AS table_name,
                 pol.polname,
                 pol.polcmd,
                 pol.polpermissive,
                 pg_catalog.pg_get_expr(pol.polqual, pol.polrelid) AS qual,
                 pg_catalog.pg_get_expr(pol.polwithcheck, pol.polrelid) AS with_check,
                 COALESCE(policy_roles.roles, ARRAY[]::name[]) AS roles
          FROM pg_catalog.pg_policy pol
          JOIN pg_catalog.pg_class relation ON relation.oid = pol.polrelid
          JOIN pg_catalog.pg_namespace namespace ON namespace.oid = relation.relnamespace
          LEFT JOIN (
            SELECT vectors.polroles,
              COALESCE(array_agg(role.rolname ORDER BY role.rolname) FILTER (WHERE role.rolname IS NOT NULL), ARRAY[]::name[]) AS roles
            FROM (SELECT DISTINCT polroles FROM pg_catalog.pg_policy) AS vectors
            LEFT JOIN pg_catalog.pg_roles role ON role.oid = ANY (vectors.polroles)
            GROUP BY vectors.polroles
          ) AS policy_roles ON policy_roles.polroles = pol.polroles
          WHERE namespace.nspname = 'public'`,
  },
  {
    name: 'publicGrants',
    sql: `SELECT n.nspname AS schema_name, c.relname AS table_name, acl.privilege_type
          FROM pg_catalog.pg_class c
          JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
          CROSS JOIN LATERAL pg_catalog.aclexplode(c.relacl) acl
          WHERE c.relacl IS NOT NULL
            AND n.nspname = 'public'
            AND c.relkind IN ('r', 'p', 'v', 'm')
            AND acl.grantee = 0
            AND acl.privilege_type IN ('SELECT', 'INSERT', 'UPDATE', 'DELETE', 'REFERENCES', 'TRIGGER', 'TRUNCATE')`,
  },
  {
    name: 'sequences',
    sql: `SELECT c.relname
          FROM pg_catalog.pg_class c
          JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
          WHERE n.nspname = 'public'
            AND c.relkind = 'S'
            AND EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = 'union_eyes_runtime')
            AND EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = 'union_eyes_system')
            AND (
              pg_catalog.has_sequence_privilege('union_eyes_runtime', c.oid, 'USAGE')
              OR pg_catalog.has_sequence_privilege('union_eyes_runtime', c.oid, 'SELECT')
              OR pg_catalog.has_sequence_privilege('union_eyes_system', c.oid, 'USAGE')
              OR pg_catalog.has_sequence_privilege('union_eyes_system', c.oid, 'SELECT')
            )`,
  },
  {
    name: 'definers',
    sql: `SELECT n.nspname, p.proname, owner.rolname AS owner, p.proconfig,
                 pg_catalog.has_function_privilege('union_eyes_runtime',p.oid,'EXECUTE') AS runtime_execute,
                 pg_catalog.has_function_privilege('union_eyes_system',p.oid,'EXECUTE') AS system_execute,
                 pg_catalog.has_function_privilege('public',p.oid,'EXECUTE') AS public_execute
          FROM pg_catalog.pg_proc p
          JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
          JOIN pg_catalog.pg_roles owner ON owner.oid = p.proowner
          WHERE p.prosecdef
            AND n.nspname NOT IN ('pg_catalog', 'information_schema')
            AND EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = 'union_eyes_runtime')
            AND EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = 'union_eyes_system')
            AND (
              pg_catalog.has_function_privilege('union_eyes_runtime', p.oid, 'EXECUTE')
              OR pg_catalog.has_function_privilege('union_eyes_system', p.oid, 'EXECUTE')
              OR pg_catalog.has_function_privilege('public', p.oid, 'EXECUTE')
            )`,
  },
  {
    name: 'currentFunctions',
    sql: `SELECT n.nspname AS schema,p.proname AS name,
          n.nspname||'.'||p.proname||'('||array_to_string(ARRAY(SELECT pg_catalog.format_type(t,NULL) FROM unnest(p.proargtypes::oid[]) t),',')||')' AS signature,
          pg_catalog.pg_get_userbyid(p.proowner) AS owner,p.prosrc AS body,l.lanname AS language,p.provolatile AS volatility,
          p.prosecdef AS definer,p.proisstrict AS strict,p.proleakproof AS leakproof,
          pg_catalog.format_type(p.prorettype,NULL) AS returns,p.proretset AS "returnsSet",
          p.proargnames AS "argumentNames",p.proargmodes AS "argumentModes",
          ARRAY(SELECT pg_catalog.format_type(t,NULL) FROM unnest(COALESCE(p.proallargtypes,p.proargtypes::oid[])) t) AS "allArgumentTypes",
          p.pronargdefaults AS "defaultCount",pg_catalog.pg_get_expr(p.proargdefaults,0) AS defaults,p.proconfig AS config,
          (SELECT pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('role',COALESCE(r.rolname,'PUBLIC'),'grantable',a.is_grantable))
            FROM pg_catalog.aclexplode(COALESCE(p.proacl,pg_catalog.acldefault('f',p.proowner))) a LEFT JOIN pg_catalog.pg_roles r ON r.oid=a.grantee
            WHERE a.privilege_type='EXECUTE') AS "executeAcl"
          FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace JOIN pg_catalog.pg_language l ON l.oid=p.prolang
          WHERE n.nspname IN ('public','user_management') ORDER BY n.nspname,p.proname,p.oid`,
  },
  {
    name: 'dedicatedRoles',
    sql: `SELECT n.nspname AS schema_name,c.relname AS table_name,
                 r.rolname AS role_name,
                 ARRAY(
                   SELECT priv
                   FROM (VALUES (1, 'SELECT'), (2, 'INSERT'), (3, 'UPDATE'), (4, 'DELETE'), (5, 'REFERENCES'), (6, 'TRIGGER'), (7, 'TRUNCATE')) AS v(ord, priv)
                   WHERE pg_catalog.has_table_privilege(r.oid, c.oid, priv)
                   ORDER BY ord
                 ) AS privileges
          FROM pg_catalog.pg_class c
          JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
          JOIN pg_catalog.pg_roles r ON r.rolname LIKE 'ue_framework_%' OR r.rolname LIKE 'nzila_auth_%'
          WHERE n.nspname IN ('public','user_management')
            AND c.relkind IN ('r', 'p')`,
  },
  {
    name: 'columnGrants',
    sql: `SELECT n.nspname AS schema_name, c.relname AS table_name, a.attname AS column_name,
                 COALESCE(g.rolname, 'PUBLIC') AS role_name, x.privilege_type,x.is_grantable
          FROM pg_catalog.pg_attribute a
          JOIN pg_catalog.pg_class c ON c.oid = a.attrelid
          JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
          CROSS JOIN LATERAL pg_catalog.aclexplode(a.attacl) x
          LEFT JOIN pg_catalog.pg_roles g ON g.oid = x.grantee
          WHERE a.attacl IS NOT NULL
            AND a.attnum <> 0
            AND NOT a.attisdropped
            AND n.nspname IN ('public', 'user_management', 'audit_security')
          ORDER BY 1, 2, 4, 5, 3`,
  },
  {
    name: 'defaults',
    sql: `SELECT n.nspname, pg_catalog.pg_get_userbyid(d.defaclrole) AS owner, d.defaclacl::text AS acl
          FROM pg_catalog.pg_default_acl d
          LEFT JOIN pg_catalog.pg_namespace n ON n.oid = d.defaclnamespace
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

/** Exact compiler-derived identities. Same-name overloads and extra ACLs deny. */
export function currentFunctionViolations(expected, actual) {
  if (!Array.isArray(expected)) return ['current function source contract is missing']
  const violations = []
  const scalar = ['schema','name','signature','owner','language','volatility','definer','strict','leakproof','returns','returnsSet','defaultCount','defaults']
  const arrays = ['argumentNames','argumentModes','allArgumentTypes','config']
  const acl = value => Array.isArray(value)
    ? [...value].sort((a,b) => String(a.role).localeCompare(String(b.role))) : value
  for (const spec of expected) {
    const matches = actual.filter(row => row.schema === spec.schema && row.name === spec.name)
    const admittedNames = expected.filter(row => row.schema === spec.schema && row.name === spec.name)
    const row = matches.find(item => item.signature === spec.signature)
    if (matches.length !== admittedNames.length || !row
      || !/^[a-f0-9]{64}$/.test(spec.bodyDigest ?? '')
      || typeof row.body !== 'string' || createHash('sha256').update(row.body).digest('hex') !== spec.bodyDigest
      || scalar.some(key => row[key] !== spec[key])
      || arrays.some(key => JSON.stringify(row[key]) !== JSON.stringify(spec[key]))
      || JSON.stringify(acl(row.executeAcl)) !== JSON.stringify(acl(spec.executeAcl))) {
      violations.push(`current function differs: ${spec.signature}`)
    }
  }
  return violations
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
    if (attributes.rolsuper !== false || attributes.rolbypassrls !== false || attributes.rolcreatedb !== false || attributes.rolcreaterole !== false) {
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
      if (relation.schema_name === 'public' && !manifest.has(relation.table_name))
        violations.push(`public.${relation.table_name} is unclassified`)
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
    if (runtime.length && payload.requiredSessionPolicy) {
      const expected = payload.requiredSessionPolicy
      const matches = (policiesByTable.get(relation.table_name) ?? []).filter(policy => policy.polname === expected.name)
      const policy = matches[0]
      if (matches.length !== 1 || !policy || policy.polcmd !== expected.command || policy.polpermissive !== expected.permissive
        || JSON.stringify(policy.roles) !== JSON.stringify(expected.roles)
        || policy.qual !== expected.predicate || policy.with_check !== expected.predicate)
        violations.push(`public.${relation.table_name} verified session policy is missing or changed`)
    }
    if (rlsRequired.has(entry.classification)) {
      if (!relation.relrowsecurity || !relation.relforcerowsecurity) {
        violations.push(`public.${relation.table_name} lacks FORCE RLS`)
      } else {
        violations.push(...policyViolations(relation.table_name, entry, policiesByTable.get(relation.table_name) ?? []))
      }
    }
  }

  const dedicatedActual = new Map()
  for (const row of rows(snapshots, 'dedicatedRoles')) {
    dedicatedActual.set(`${row.schema_name ?? 'public'}.${row.table_name}|${row.role_name}`, asArray(row.privileges))
  }
  for (const expected of payload.dedicatedRolePrivileges ?? []) {
    const schema = expected.schema ?? 'public'
    const present = rows(snapshots,'relations').some(row => row.schema_name === schema && row.table_name === expected.table)
    if (!present) continue
    const actual = dedicatedActual.get(`${schema}.${expected.table}|${expected.role}`) ?? []
    if (JSON.stringify([...actual].sort()) !== JSON.stringify([...expected.privileges].sort())) {
      violations.push(`${schema}.${expected.table} ${expected.role} privileges are [${actual}]`)
    }
  }
  for (const row of rows(snapshots,'dedicatedRoles')) {
    if (!asArray(row.privileges).length) continue
    if (!(payload.dedicatedRolePrivileges ?? []).some(expected => (expected.schema ?? 'public') === (row.schema_name ?? 'public')
      && expected.table === row.table_name && expected.role === row.role_name))
      violations.push(`${row.schema_name ?? 'public'}.${row.table_name} ${row.role_name} has undeclared table privileges`)
  }

  for (const row of rows(snapshots, 'publicGrants')) {
    violations.push(`PUBLIC holds ${row.privilege_type} on ${row.schema_name}.${row.table_name}`)
  }
  for (const row of rows(snapshots, 'sequences')) violations.push(`public sequence ${row.relname} is granted`)
  violations.push(...currentFunctionViolations(payload.currentFunctions, rows(snapshots,'currentFunctions')))
  for (const row of rows(snapshots, 'definers')) {
    const expected = (payload.currentFunctions ?? []).find(entry => entry.schema === row.nspname && entry.name === row.proname)
    const effective = role => Boolean(expected?.executeAcl?.some(grant => grant.role === role))
    if (!expected || row.owner !== expected.owner || JSON.stringify(row.proconfig) !== JSON.stringify(expected.config)
      || row.runtime_execute !== effective('union_eyes_runtime')
      || row.system_execute !== effective('union_eyes_system') || row.public_execute !== effective('PUBLIC')) {
      violations.push(`${row.nspname}.${row.proname} is a SECURITY DEFINER function executable by a runtime principal`)
    }
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
    if (row.is_grantable !== (approvedColumns.get(key).grantable ?? false))
      violations.push(`${row.schema_name}.${row.table_name}.${row.column_name} column grant option differs`)
    if (!approvedColumns.get(key).columns.includes(row.column_name))
      violations.push(`${row.schema_name}.${row.table_name}.${row.column_name} is outside the source column ACL`)
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
